//! Namespace commands.
//!
//! Not macro-generated: only list/watch/delete are exposed, so the standard
//! `k8s_cluster_commands!` set does not fit.

use crate::commands::common::start_watch;
use crate::error::AppResult;
use crate::manager::k8s::cluster_resources::K8sClusterResources;
use crate::utils::watcher::WatchManager;
use k8s_openapi::api::core::v1::Namespace;
use serde_json::Value;
use tauri::AppHandle;

#[tauri::command]
pub async fn list_namespaces(name: String) -> AppResult<Vec<Value>> {
    K8sClusterResources::<Namespace>::list(name).await
}

#[tauri::command]
pub async fn watch_namespaces(
    app_handle: AppHandle,
    name: String,
    state: tauri::State<'_, WatchManager>,
) -> AppResult<String> {
    start_watch(
        app_handle,
        name,
        "namespaces",
        None,
        state,
        K8sClusterResources::<Namespace>::watch,
    )
    .await
}

#[tauri::command]
pub async fn delete_namespaces(
    name: String,
    resource_names: Vec<String>,
) -> AppResult<Vec<Result<String, String>>> {
    K8sClusterResources::<Namespace>::delete(name, resource_names).await
}
