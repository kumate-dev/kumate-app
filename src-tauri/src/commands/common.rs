//! Shared plumbing for the resource command surface.

use jiff::Timestamp;
use serde_json::Value;
use tauri::AppHandle;
use tokio_util::sync::CancellationToken;

use crate::error::AppResult;
use crate::manager::k8s::store::ResourceStore;
use crate::utils::watcher::{
    build_event_name, cluster_event_prefix, unescape_segment, validate_resource_name, WatchManager,
};

/// Register a watch and return its event-channel name.
///
/// The returned name is what the frontend listens on, and doubles as the key for
/// both [`WatchManager`] and [`ResourceStore`]. Calling this twice for the same
/// selection is a no-op that returns the same name.
pub async fn start_watch<F, Fut>(
    app_handle: AppHandle,
    context: String,
    resource: &str,
    namespaces: Option<Vec<String>>,
    state: tauri::State<'_, WatchManager>,
    watch_fn: F,
) -> AppResult<String>
where
    F: FnOnce(AppHandle, String, Option<Vec<String>>, String, CancellationToken) -> Fut
        + Send
        + 'static,
    Fut: std::future::Future<Output = AppResult<()>> + Send + 'static,
{
    validate_resource_name(resource)?;

    let namespaces = namespaces.filter(|v| !v.is_empty()).map(|mut v| {
        // Sorted + deduped so the same selection always yields the same event name,
        // whatever order the UI happens to send it in.
        v.sort();
        v.dedup();
        v
    });

    let event_name = build_event_name(&context, resource, namespaces.as_deref());
    let event_name_for_task = event_name.clone();

    state
        .watch(
            app_handle,
            event_name.clone(),
            move |app, cancel| async move {
                watch_fn(app, context, namespaces, event_name_for_task, cancel).await
            },
        )
        .await?;

    Ok(event_name)
}

#[tauri::command]
pub async fn unwatch(state: tauri::State<'_, WatchManager>, name: String) -> AppResult<()> {
    state.unwatch(&name).await
}

/// Stop every watch belonging to a cluster.
///
/// Takes the *raw* context name and derives the prefix here. The frontend used to build
/// `k8s://${context}/` itself, which broke the moment event names started being escaped:
/// a context like `kubernetes-admin@kubernetes` is registered as
/// `k8s://kubernetes-admin_40kubernetes/`, so the hand-built prefix matched nothing and
/// every watch for that cluster survived a cluster switch. Escaping now lives in exactly
/// one place, on this side of the IPC boundary.
#[tauri::command]
pub async fn unwatch_cluster(
    state: tauri::State<'_, WatchManager>,
    context: String,
) -> AppResult<u32> {
    state.unwatch_prefix(&cluster_event_prefix(&context)).await
}

#[tauri::command]
pub async fn watchers_count(state: tauri::State<'_, WatchManager>) -> AppResult<usize> {
    Ok(state.count().await)
}

/// Full current contents of the in-memory cache for a watch, served without
/// touching the apiserver.
///
/// A live watch already holds every object it has seen, so a page revisit does not
/// need to re-`list`.
///
/// `synced` is the load-bearing part. The backend emits its initial `ADDED` burst and
/// the `SYNCED` marker as soon as `watch_*` returns, but the frontend can only attach
/// its listener *after* that call resolves — so on a fast or empty resource the whole
/// sequence can be over before anyone is listening. An empty `items` is then ambiguous:
/// "this kind has nothing in it" and "the listing has not happened yet" look identical,
/// and the UI sat on a skeleton forever. `synced` distinguishes them:
///
/// * `synced: true`  — `items` is the complete, authoritative set, empty or not.
/// * `synced: false` — a listing is still in flight; wait for the `SYNCED` event.
#[tauri::command]
pub async fn snapshot_resources(event_name: String) -> AppResult<Value> {
    let store = ResourceStore::global();

    // Read the flag first. If a stream finishes between these two reads we report
    // `synced: false` with a complete list, and the frontend simply waits for the
    // marker it is now guaranteed to receive. The reverse order could report
    // `synced: true` alongside a list that is missing objects.
    let synced = store.is_synced(&event_name).await;
    let items = store.snapshot(&event_name).await;

    Ok(serde_json::json!({ "synced": synced, "items": items }))
}

/// Diagnostics for the watch/cache layer, surfaced in the UI status bar.
#[tauri::command]
pub async fn watch_diagnostics(state: tauri::State<'_, WatchManager>) -> AppResult<Value> {
    let store = ResourceStore::global();
    Ok(serde_json::json!({
        "watchers": state.count().await,
        "maxWatchers": crate::constants::watch::MAX_WATCHERS,
        "cachedObjects": store.total_objects().await,
        "cachedClients": crate::manager::k8s::client::ClientRegistry::global().cached_contexts().await,
        // Decoded for display: the raw channel names carry `_XX` escapes for any
        // character Tauri disallows, which is unreadable in the status-bar tooltip.
        "active": state.active().await.iter().map(|name| readable_event_name(name)).collect::<Vec<_>>(),
    }))
}

/// Turn an escaped channel name back into something a human can read.
///
/// Only the cluster and namespace segments are escaped, so this decodes the whole string
/// segment-wise and leaves the `k8s://` scheme and the resource path alone.
fn readable_event_name(event_name: &str) -> String {
    match event_name.strip_prefix("k8s://") {
        Some(rest) => {
            let decoded: Vec<String> = rest.split('/').map(unescape_segment).collect();
            format!("k8s://{}", decoded.join("/"))
        }
        None => event_name.to_string(),
    }
}

pub fn restart_patch() -> Value {
    // k8s-openapi 0.27 dropped its chrono re-export for jiff, so the clock comes from
    // jiff now. `Timestamp`'s `Display` is plain RFC 3339 with a `Z` offset and *no*
    // RFC 9557 `[UTC]` zone annotation (annotations only appear on `Zoned`), which is
    // what the apiserver must see here — a bracketed suffix would be stored verbatim
    // and break any consumer parsing the annotation as a timestamp.
    //
    // The rendering differs from chrono's `to_rfc3339()` only in spelling `+00:00` as
    // `Z`; both are valid RFC 3339 and the annotation is only ever compared for
    // inequality by the Deployment controller.
    serde_json::json!({
        "spec": {
            "template": {
                "metadata": {
                    "annotations": {
                        "kumate.dev/restartedAt": Timestamp::now().to_string()
                    }
                }
            }
        }
    })
}

pub fn scale_patch(replicas: i32) -> Value {
    serde_json::json!({
        "spec": { "replicas": replicas }
    })
}

pub fn suspend_patch(suspend: bool) -> Value {
    serde_json::json!({
        "spec": { "suspend": suspend }
    })
}
