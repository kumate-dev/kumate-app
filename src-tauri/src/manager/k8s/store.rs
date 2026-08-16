//! In-memory resource cache backing the watch streams.
//!
//! Every live watch owns a *shard* keyed by `(event_name, namespace)`. The shard
//! holds the last-known JSON for each object it has seen. This buys three things:
//!
//! 1. **Correct deletes across reconnects.** `kube`'s `watcher()` restarts with
//!    `Init` → `InitApply`* → `InitDone` whenever the resourceVersion goes stale
//!    (410 Gone). Objects deleted while we were disconnected simply never appear
//!    in the new list. Diffing the init set against the shard lets us synthesize
//!    the missing `DELETED` events, so the UI cannot show phantom rows. The old
//!    raw-`Api::watch` implementation had no way to detect this at all.
//! 2. **A snapshot source.** `snapshot()` serves a full resource list from memory,
//!    so revisiting a page costs zero apiserver requests while a watch is live.
//! 3. **Bounded memory.** `managedFields` is stripped before objects land here
//!    (see `watch_loop`), which typically halves the retained size per object.
//!
//! The store is a process-global for the same reason [`super::client::ClientRegistry`]
//! is: the watch plumbing is reached from static command functions.

use std::collections::{HashMap, HashSet};
use std::sync::{Arc, OnceLock};

use serde_json::Value;
use tokio::sync::RwLock;

/// Identifies an object within a shard. Cluster-scoped objects use `None`.
pub type ObjectKey = (Option<String>, String);

/// Unit separator — cannot occur in a Kubernetes namespace name or in our
/// `k8s://…` event names, so it is a safe composite-key delimiter.
const SEP: char = '\u{1f}';

pub fn shard_key(event_name: &str, namespace: Option<&str>) -> String {
    match namespace {
        Some(ns) => format!("{event_name}{SEP}{ns}"),
        None => format!("{event_name}{SEP}"),
    }
}

#[derive(Default)]
struct Shard {
    objects: HashMap<ObjectKey, Arc<Value>>,
    /// Keys seen since the most recent `Init`. `None` outside an init window.
    init_seen: Option<HashSet<ObjectKey>>,
}

/// Initial-sync bookkeeping for one event name.
///
/// A watch drives one stream per selected namespace, so "the initial listing is
/// complete" is only true once *every* stream has reported `InitDone`.
#[derive(Default)]
struct EventSync {
    /// Shards this watch will drive. Registered before any stream is polled.
    registered: HashSet<String>,
    /// Shards that have completed their first init.
    initialised: HashSet<String>,
}

impl EventSync {
    fn synced(&self) -> bool {
        !self.registered.is_empty() && self.initialised.len() >= self.registered.len()
    }
}

#[derive(Default)]
pub struct ResourceStore {
    shards: RwLock<HashMap<String, Shard>>,
    /// Per-event initial-sync state. Separate from `shards` because it is keyed by
    /// event name, and because it must survive a shard being empty.
    sync: RwLock<HashMap<String, EventSync>>,
}

impl ResourceStore {
    pub fn global() -> &'static ResourceStore {
        static STORE: OnceLock<ResourceStore> = OnceLock::new();
        STORE.get_or_init(ResourceStore::default)
    }

    /// Declare that `shard` belongs to `event_name` and has not synced yet.
    ///
    /// Called by each stream before it is polled, so the full set of shards is known
    /// before any of them can finish. That ordering is what makes [`is_synced`] safe to
    /// trust: it can never report "synced" while a sibling namespace is still listing.
    ///
    /// [`is_synced`]: Self::is_synced
    pub async fn register_shard(&self, event_name: &str, shard: &str) {
        let mut sync = self.sync.write().await;
        sync.entry(event_name.to_string())
            .or_default()
            .registered
            .insert(shard.to_string());
    }

    /// Record that `shard` has finished its initial listing.
    ///
    /// Deliberately sticky: a later recovery relist re-opens an init window on the
    /// shard, but the event stays synced. The UI uses this only to decide whether it
    /// may stop showing a skeleton, and flipping back to a skeleton because the
    /// connection blipped would be worse than showing slightly stale rows.
    pub async fn mark_initialised(&self, event_name: &str, shard: &str) {
        let mut sync = self.sync.write().await;
        sync.entry(event_name.to_string())
            .or_default()
            .initialised
            .insert(shard.to_string());
    }

    /// True once every stream for this event has completed its initial listing.
    ///
    /// `false` when nothing is registered, which callers should read as "no watch is
    /// running, fall back to a list".
    pub async fn is_synced(&self, event_name: &str) -> bool {
        self.sync
            .read()
            .await
            .get(event_name)
            .is_some_and(EventSync::synced)
    }

    /// A relist has started. Begin recording which keys the apiserver reports.
    pub async fn begin_init(&self, shard: &str) {
        let mut shards = self.shards.write().await;
        shards.entry(shard.to_string()).or_default().init_seen = Some(HashSet::new());
    }

    /// Record an object received during the init window.
    pub async fn apply_init(&self, shard: &str, key: ObjectKey, object: Arc<Value>) {
        let mut shards = self.shards.write().await;
        let entry = shards.entry(shard.to_string()).or_default();
        if let Some(seen) = entry.init_seen.as_mut() {
            seen.insert(key.clone());
        }
        entry.objects.insert(key, object);
    }

    /// Close the init window and return the objects that vanished while we were
    /// not watching. Callers must emit a `DELETED` event for each.
    pub async fn finish_init(&self, shard: &str) -> Vec<Arc<Value>> {
        let mut shards = self.shards.write().await;
        let Some(entry) = shards.get_mut(shard) else {
            return Vec::new();
        };
        let Some(seen) = entry.init_seen.take() else {
            return Vec::new();
        };

        let stale: Vec<ObjectKey> = entry
            .objects
            .keys()
            .filter(|k| !seen.contains(*k))
            .cloned()
            .collect();

        stale
            .into_iter()
            .filter_map(|k| entry.objects.remove(&k))
            .collect()
    }

    /// Upsert an object outside an init window.
    pub async fn apply(&self, shard: &str, key: ObjectKey, object: Arc<Value>) {
        let mut shards = self.shards.write().await;
        shards
            .entry(shard.to_string())
            .or_default()
            .objects
            .insert(key, object);
    }

    pub async fn delete(&self, shard: &str, key: &ObjectKey) {
        let mut shards = self.shards.write().await;
        if let Some(entry) = shards.get_mut(shard) {
            entry.objects.remove(key);
        }
    }

    /// All objects currently cached for an event name, across every namespace shard.
    pub async fn snapshot(&self, event_name: &str) -> Vec<Value> {
        let prefix = format!("{event_name}{SEP}");
        let shards = self.shards.read().await;
        shards
            .iter()
            .filter(|(k, _)| k.starts_with(&prefix))
            .flat_map(|(_, shard)| shard.objects.values().map(|v| v.as_ref().clone()))
            .collect()
    }

    // /// Number of objects cached for an event name. Cheap; use for diagnostics.
    // pub async fn len(&self, event_name: &str) -> usize {
    //     let prefix = format!("{event_name}{SEP}");
    //     let shards = self.shards.read().await;
    //     shards
    //         .iter()
    //         .filter(|(k, _)| k.starts_with(&prefix))
    //         .map(|(_, shard)| shard.objects.len())
    //         .sum()
    // }

    /// Drop exactly one shard. Must be an exact key match: namespace names are
    /// prefixes of one another (`default` / `default2`), so prefix-based removal
    /// would take out unrelated shards.
    pub async fn drop_shard(&self, event_name: &str, shard: &str) {
        self.shards.write().await.remove(shard);

        let mut sync = self.sync.write().await;
        if let Some(entry) = sync.get_mut(event_name) {
            entry.registered.remove(shard);
            entry.initialised.remove(shard);
            if entry.registered.is_empty() {
                sync.remove(event_name);
            }
        }
    }

    /// Drop every shard belonging to an event name. Called when a watch stops, so
    /// the cache never outlives the stream that keeps it correct.
    pub async fn drop_event(&self, event_name: &str) {
        let prefix = format!("{event_name}{SEP}");
        self.shards
            .write()
            .await
            .retain(|k, _| !k.starts_with(&prefix));
        self.sync.write().await.remove(event_name);
    }

    /// Drop every shard whose event name starts with `prefix` (e.g. all shards for
    /// one cluster: `k8s://my-cluster/`).
    pub async fn drop_matching(&self, prefix: &str) {
        self.shards
            .write()
            .await
            .retain(|k, _| !k.starts_with(prefix));
        self.sync
            .write()
            .await
            .retain(|k, _| !k.starts_with(prefix));
    }

    pub async fn total_objects(&self) -> usize {
        self.shards
            .read()
            .await
            .values()
            .map(|s| s.objects.len())
            .sum()
    }
}
