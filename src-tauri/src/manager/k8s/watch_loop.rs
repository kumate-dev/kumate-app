//! The single watch driver used by every resource kind.
//!
//! This replaces three verbatim copies of a hand-rolled `Api::watch` loop that
//! lived in `resources.rs`, `cluster_resources.rs` and `dynamic_resources.rs`.
//! Those copies had no resourceVersion bookmarking, no relist on `410 Gone`, and
//! no reconnect: when the stream ended — which the apiserver does routinely, every
//! few minutes — the task simply returned and the UI froze silently.
//!
//! `kube::runtime::watcher` handles bookmarking, relisting and stream recovery.
//! What it does *not* do is tell the UI which objects disappeared during a relist,
//! so we diff each `Init` window against [`ResourceStore`] and synthesize the
//! missing `DELETED` events ourselves.
//!
//! Cancellation is cooperative via [`CancellationToken`]. Every namespace stream
//! for a watch shares one token, so `WatchManager::unwatch` tears all of them down
//! — the previous code spawned per-namespace tasks that nothing held a handle to
//! and which therefore leaked for the lifetime of the process.

use std::sync::Arc;
use std::time::Duration;

use futures_util::StreamExt;
use kube::runtime::watcher::{self, watcher, Event};
use kube::{Api, Resource, ResourceExt};
use serde::{de::DeserializeOwned, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Emitter};
use tokio_util::sync::CancellationToken;

use crate::manager::k8s::store::{shard_key, ObjectKey, ResourceStore};
use crate::types::event::EventType;

/// Backoff bounds applied after a watch error. `watcher()` recovers on the next
/// poll, so *not polling* for a while is how you throttle a reconnect storm —
/// this is the mechanism the kube-rs docs recommend.
const BACKOFF_MIN: Duration = Duration::from_millis(500);
const BACKOFF_MAX: Duration = Duration::from_secs(30);

/// Consecutive pre-sync failures before we tell the UI the watch is not working.
/// Three, so a transient blip during startup does not surface as an error.
const FAILURES_BEFORE_REPORTING: u32 = 3;

/// Drive one namespace's watch stream until cancelled.
///
/// Returns when `cancel` fires. Never returns on transient errors — that was the
/// bug this design exists to prevent.
pub async fn run<K>(
    app: AppHandle,
    event_name: String,
    namespace: Option<String>,
    api: Api<K>,
    cancel: CancellationToken,
) where
    K: Resource + Clone + std::fmt::Debug + DeserializeOwned + Serialize + Send + 'static,
{
    let shard = shard_key(&event_name, namespace.as_deref());
    let store = ResourceStore::global();
    let mut backoff = BACKOFF_MIN;
    let mut consecutive_failures: u32 = 0;
    let mut reported_failure = false;

    // Register before the stream is built. Every sibling namespace does the same on the
    // first poll of the `join_all`, long before any of them can complete a listing, so
    // `is_synced` can never claim the event is ready while a namespace is still loading.
    store.register_shard(&event_name, &shard).await;

    let mut stream = Box::pin(watcher(api, watcher::Config::default()));

    loop {
        let item = tokio::select! {
            biased;
            _ = cancel.cancelled() => break,
            item = stream.next() => item,
        };

        // `watcher()` is an endless stream; `None` should not happen. Treat it as
        // fatal for this shard rather than spinning on a dead stream.
        let Some(item) = item else {
            tracing::warn!(event = %event_name, "watch stream ended unexpectedly");
            break;
        };

        match item {
            Ok(event) => {
                backoff = BACKOFF_MIN;
                consecutive_failures = 0;
                reported_failure = false;
                handle_event(&app, &event_name, &shard, store, event).await;
            }
            Err(err) => {
                consecutive_failures += 1;

                // Only speak up while the UI still has nothing to show. Once the initial
                // listing has landed, a failing stream is a recoverable blip and the rows
                // on screen stay correct, so surfacing it would be noise.
                if !reported_failure
                    && consecutive_failures >= FAILURES_BEFORE_REPORTING
                    && !store.is_synced(&event_name).await
                {
                    reported_failure = true;
                    emit_failure(&app, &event_name, &crate::error::redact(&err.to_string()));
                }

                tracing::warn!(
                    event = %event_name,
                    error = %crate::error::redact(&err.to_string()),
                    backoff_ms = backoff.as_millis() as u64,
                    "watch error, backing off before recovery"
                );
                tokio::select! {
                    biased;
                    _ = cancel.cancelled() => break,
                    _ = tokio::time::sleep(backoff) => {}
                }
                backoff = (backoff * 2).min(BACKOFF_MAX);
            }
        }
    }

    // The cache is only trustworthy while the stream that maintains it is alive.
    store.drop_shard(&event_name, &shard).await;
    tracing::debug!(event = %event_name, "watch stopped");
}

async fn handle_event<K>(
    app: &AppHandle,
    event_name: &str,
    shard: &str,
    store: &'static ResourceStore,
    event: Event<K>,
) where
    K: Resource + Clone + Serialize,
{
    // Drop `managedFields` before the object is cached or serialized. It is never
    // rendered, is frequently the largest part of an object, and shrinking it here
    // reduces both retained memory and IPC payload size.
    let event = event.modify(|obj| {
        obj.managed_fields_mut().clear();
    });

    match event {
        Event::Init => {
            store.begin_init(shard).await;
        }
        Event::InitApply(obj) => {
            let (key, value) = match split(&obj) {
                Some(pair) => pair,
                None => return,
            };
            store.apply_init(shard, key, Arc::clone(&value)).await;
            emit(app, event_name, EventType::ADDED, &value);
        }
        Event::InitDone => {
            // Anything the apiserver did not list is gone. Without this the UI
            // would keep showing rows for objects deleted while disconnected.
            for stale in store.finish_init(shard).await {
                emit(app, event_name, EventType::DELETED, &stale);
            }

            // Record it before emitting, so a frontend that calls `snapshot_resources`
            // in response to `SYNCED` cannot observe the marker without the flag.
            store.mark_initialised(event_name, shard).await;
            emit_marker(app, event_name, EventType::SYNCED);
        }
        Event::Apply(obj) => {
            let (key, value) = match split(&obj) {
                Some(pair) => pair,
                None => return,
            };
            store.apply(shard, key, Arc::clone(&value)).await;
            emit(app, event_name, EventType::MODIFIED, &value);
        }
        Event::Delete(obj) => {
            let (key, value) = match split(&obj) {
                Some(pair) => pair,
                None => return,
            };
            store.delete(shard, &key).await;
            emit(app, event_name, EventType::DELETED, &value);
        }
    }
}

/// Extract the cache key and JSON for an object.
///
/// Returns `None` if serialization fails. The previous code substituted
/// `Value::Null` here, which pushed a null row into the UI and made the failure
/// impossible to diagnose.
fn split<K>(obj: &K) -> Option<(ObjectKey, Arc<Value>)>
where
    K: Resource + Serialize,
{
    let key: ObjectKey = (obj.namespace(), obj.name_any());
    match serde_json::to_value(obj) {
        Ok(value) => Some((key, Arc::new(value))),
        Err(err) => {
            tracing::error!(
                name = %key.1,
                error = %err,
                "failed to serialize object, dropping watch event"
            );
            None
        }
    }
}

fn emit(app: &AppHandle, event_name: &str, kind: EventType, object: &Value) {
    let payload = serde_json::json!({ "type": kind, "object": object });
    if let Err(err) = app.emit(event_name, payload) {
        tracing::warn!(event = %event_name, error = %err, "failed to emit watch event");
    }
}

/// Tell the UI this watch is not working, so it can stop showing a loading state.
fn emit_failure(app: &AppHandle, event_name: &str, message: &str) {
    tracing::warn!(event = %event_name, message, "watch failing before first sync");
    let payload = serde_json::json!({
        "type": EventType::FAILED,
        "object": { "message": message },
    });
    let _ = app.emit(event_name, payload);
}

/// Emit a payload-less lifecycle marker on the same channel.
fn emit_marker(app: &AppHandle, event_name: &str, kind: EventType) {
    let payload = serde_json::json!({ "type": kind, "object": Value::Null });
    let _ = app.emit(event_name, payload);
}
