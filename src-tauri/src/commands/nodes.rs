use std::sync::Arc;

use crate::{
    commands::common::watch, services::k8s::cluster_resources::K8sClusterResources,
    utils::watcher::WatchManager,
};
use k8s_openapi::api::core::v1::Node;
use serde_json::Value;
use tauri::AppHandle;

#[tauri::command]
pub async fn list_nodes(name: String) -> Result<Vec<Value>, String> {
    K8sClusterResources::<Node>::list(name).await
}

#[tauri::command]
pub async fn watch_nodes(
    app_handle: AppHandle,
    name: String,
    state: tauri::State<'_, WatchManager>,
) -> Result<String, String> {
    watch(
        app_handle,
        name,
        "nodes".to_string(),
        None,
        state,
        Arc::new(|app_handle, name, _namespaces, event_name| {
            K8sClusterResources::<Node>::watch(app_handle, name, event_name)
        }),
    )
    .await
}

#[tauri::command]
pub async fn delete_nodes(
    name: String,
    resource_names: Vec<String>,
) -> Result<Vec<Result<String, String>>, String> {
    Ok(K8sClusterResources::<Node>::delete(name, resource_names).await?)
}
