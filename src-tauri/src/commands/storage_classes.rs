use std::sync::Arc;

use crate::{
    commands::common::watch, manager::k8s::cluster_resources::K8sClusterResources,
    utils::watcher::WatchManager,
};
use k8s_openapi::api::storage::v1::StorageClass;
use serde_json::Value;
use tauri::AppHandle;

#[tauri::command]
pub async fn create_storage_class(name: String, manifest: Value) -> Result<Value, String> {
    K8sClusterResources::<StorageClass>::create(name, manifest).await
}

#[tauri::command]
pub async fn update_storage_class(name: String, manifest: Value) -> Result<Value, String> {
    K8sClusterResources::<StorageClass>::update(name, manifest).await
}

#[tauri::command]
pub async fn list_storage_classes(name: String) -> Result<Vec<Value>, String> {
    K8sClusterResources::<StorageClass>::list(name).await
}

#[tauri::command]
pub async fn watch_storage_classes(
    app_handle: AppHandle,
    name: String,
    state: tauri::State<'_, WatchManager>,
) -> Result<String, String> {
    watch(
        app_handle,
        name,
        "storage_classes".to_string(),
        None,
        state,
        Arc::new(|app_handle, name, _namespaces, event_name| {
            K8sClusterResources::<StorageClass>::watch(app_handle, name, event_name)
        }),
    )
    .await
}

#[tauri::command]
pub async fn delete_storage_classes(
    name: String,
    resource_names: Vec<String>,
) -> Result<Vec<Result<String, String>>, String> {
    Ok(K8sClusterResources::<StorageClass>::delete(name, resource_names).await?)
}
