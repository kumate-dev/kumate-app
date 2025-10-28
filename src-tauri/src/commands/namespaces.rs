use std::sync::Arc;

use crate::{
    commands::common::watch, services::k8s::cluster_resources::K8sClusterResources,
    utils::watcher::WatchManager,
};
use k8s_openapi::api::core::v1::Namespace;
use serde_json::Value;
use tauri::AppHandle;

#[tauri::command]
pub async fn list_namespaces(name: String) -> Result<Vec<Value>, String> {
    K8sClusterResources::<Namespace>::list(name).await
}

#[tauri::command]
pub async fn watch_namespaces(
    app_handle: AppHandle,
    name: String,
    state: tauri::State<'_, WatchManager>,
) -> Result<String, String> {
    watch(
        app_handle,
        name,
        "namespaces".to_string(),
        None,
        state,
        Arc::new(|app_handle, name, _namespaces, event_name| {
            K8sClusterResources::<Namespace>::watch(app_handle, name, event_name)
        }),
    )
    .await
}

#[tauri::command]
pub async fn delete_namespaces(
    name: String,
    resource_names: Vec<String>,
) -> Result<Vec<Result<String, String>>, String> {
    Ok(K8sClusterResources::<Namespace>::delete(name, resource_names).await?)
}
