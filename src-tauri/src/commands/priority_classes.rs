use std::sync::Arc;

use crate::{
    commands::common::watch, manager::k8s::cluster_resources::K8sClusterResources,
    utils::watcher::WatchManager,
};
use k8s_openapi::api::scheduling::v1::PriorityClass;
use serde_json::Value;
use tauri::AppHandle;

#[tauri::command]
pub async fn create_priority_class(name: String, manifest: Value) -> Result<Value, String> {
    K8sClusterResources::<PriorityClass>::create(name, manifest).await
}

#[tauri::command]
pub async fn update_priority_class(name: String, manifest: Value) -> Result<Value, String> {
    K8sClusterResources::<PriorityClass>::update(name, manifest).await
}

#[tauri::command]
pub async fn list_priority_classes(name: String) -> Result<Vec<Value>, String> {
    K8sClusterResources::<PriorityClass>::list(name).await
}

#[tauri::command]
pub async fn watch_priority_classes(
    app_handle: AppHandle,
    name: String,
    state: tauri::State<'_, WatchManager>,
) -> Result<String, String> {
    watch(
        app_handle,
        name,
        "priority_classes".to_string(),
        None,
        state,
        Arc::new(|app_handle, name, _namespaces, event_name| {
            K8sClusterResources::<PriorityClass>::watch(app_handle, name, event_name)
        }),
    )
    .await
}

#[tauri::command]
pub async fn delete_priority_classes(
    name: String,
    resource_names: Vec<String>,
) -> Result<Vec<Result<String, String>>, String> {
    Ok(K8sClusterResources::<PriorityClass>::delete(name, resource_names).await?)
}
