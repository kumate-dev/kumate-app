use std::sync::Arc;

use crate::{
    commands::common::watch, manager::k8s::cluster_resources::K8sClusterResources,
    utils::watcher::WatchManager,
};
use k8s_openapi::api::core::v1::PersistentVolume;
use serde_json::Value;
use tauri::AppHandle;

#[tauri::command]
pub async fn create_persistent_volume(name: String, manifest: Value) -> Result<Value, String> {
    K8sClusterResources::<PersistentVolume>::create(name, manifest).await
}

#[tauri::command]
pub async fn update_persistent_volume(name: String, manifest: Value) -> Result<Value, String> {
    K8sClusterResources::<PersistentVolume>::update(name, manifest).await
}

#[tauri::command]
pub async fn list_persistent_volumes(name: String) -> Result<Vec<Value>, String> {
    K8sClusterResources::<PersistentVolume>::list(name).await
}

#[tauri::command]
pub async fn watch_persistent_volumes(
    app_handle: AppHandle,
    name: String,
    state: tauri::State<'_, WatchManager>,
) -> Result<String, String> {
    watch(
        app_handle,
        name,
        "persistent_volumes".to_string(),
        None,
        state,
        Arc::new(|app_handle, name, _namespaces, event_name| {
            K8sClusterResources::<PersistentVolume>::watch(app_handle, name, event_name)
        }),
    )
    .await
}

#[tauri::command]
pub async fn delete_persistent_volumes(
    name: String,
    resource_names: Vec<String>,
) -> Result<Vec<Result<String, String>>, String> {
    Ok(K8sClusterResources::<PersistentVolume>::delete(name, resource_names).await?)
}
