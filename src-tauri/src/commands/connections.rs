//! Cluster connect/disconnect commands.

use crate::error::AppResult;
use crate::manager::k8s::client::ClientRegistry;
use crate::utils::connections::ConnectionsManager;
use crate::utils::watcher::{cluster_event_prefix, WatchManager};

#[tauri::command]
pub async fn set_context_connection(
    name: String,
    connected: bool,
    wm: tauri::State<'_, WatchManager>,
) -> AppResult<()> {
    ConnectionsManager::global()
        .set(name.clone(), connected)
        .await;

    if !connected {
        // Watch keys are `k8s://<context>/<resource>[/ns/…]`, so the old
        // `unwatch(&name)` — passing a bare context name — never matched anything
        // and disconnecting left every watcher for the cluster running. Tear the
        // whole cluster down by prefix instead.
        //
        // The prefix MUST come from `cluster_event_prefix`, not from `format!`: the
        // context is escaped when the watch is registered, so an unescaped prefix would
        // silently match nothing for any cluster whose name contains a character Tauri
        // disallows — which includes kubeadm's default `kubernetes-admin@kubernetes`.
        let prefix = cluster_event_prefix(&name);
        let stopped = wm.unwatch_prefix(&prefix).await?;

        // Drop the cached client too, so reconnecting re-reads the kubeconfig and
        // re-runs any auth plugin rather than reusing possibly-stale credentials.
        ClientRegistry::global().invalidate(&name).await;

        tracing::info!(context = %name, stopped, "disconnected cluster");
    } else {
        tracing::info!(context = %name, "connected cluster");
    }

    Ok(())
}

#[tauri::command]
pub async fn get_context_connections() -> AppResult<Vec<(String, bool)>> {
    Ok(ConnectionsManager::global().list().await)
}

#[tauri::command]
pub async fn get_context_connection(name: String) -> AppResult<bool> {
    Ok(ConnectionsManager::global().is_connected(&name).await)
}
