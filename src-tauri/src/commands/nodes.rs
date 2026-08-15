//! Node commands.
//!
//! Not macro-generated: Nodes expose only list/watch/delete (no create/update —
//! nodes are registered by kubelets, not by users), so the standard
//! `k8s_cluster_commands!` set does not fit.

use crate::commands::common::start_watch;
use crate::error::AppResult;
use crate::manager::k8s::cluster_resources::K8sClusterResources;
use crate::utils::watcher::WatchManager;
use k8s_openapi::api::core::v1::Node;
use serde_json::Value;
use tauri::AppHandle;

#[tauri::command]
pub async fn list_nodes(name: String) -> AppResult<Vec<Value>> {
    K8sClusterResources::<Node>::list(name).await
}

#[tauri::command]
pub async fn watch_nodes(
    app_handle: AppHandle,
    name: String,
    state: tauri::State<'_, WatchManager>,
) -> AppResult<String> {
    // The cluster-scoped `watch` now takes the same 5 arguments as the namespaced
    // one (ignoring `namespaces`), so it can be passed directly instead of being
    // wrapped in an adapter closure behind an `Arc`.
    start_watch(
        app_handle,
        name,
        "nodes",
        None,
        state,
        K8sClusterResources::<Node>::watch,
    )
    .await
}

#[tauri::command]
pub async fn delete_nodes(
    name: String,
    resource_names: Vec<String>,
) -> AppResult<Vec<Result<String, String>>> {
    K8sClusterResources::<Node>::delete(name, resource_names).await
}
