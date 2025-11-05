use std::sync::Arc;

use crate::{
    commands::common::watch, manager::k8s::cluster_resources::K8sClusterResources,
    utils::watcher::WatchManager,
};
use k8s_openapi::api::node::v1::RuntimeClass;
use serde_json::Value;
use tauri::AppHandle;

#[tauri::command]
pub async fn create_runtime_class(name: String, manifest: Value) -> Result<Value, String> {
    K8sClusterResources::<RuntimeClass>::create(name, manifest).await
}

#[tauri::command]
pub async fn update_runtime_class(name: String, manifest: Value) -> Result<Value, String> {
    K8sClusterResources::<RuntimeClass>::update(name, manifest).await
}

#[tauri::command]
pub async fn list_runtime_classes(name: String) -> Result<Vec<Value>, String> {
    K8sClusterResources::<RuntimeClass>::list(name).await
}

#[tauri::command]
pub async fn watch_runtime_classes(
    app_handle: AppHandle,
    name: String,
    state: tauri::State<'_, WatchManager>,
) -> Result<String, String> {
    watch(
        app_handle,
        name,
        "runtime_classes".to_string(),
        None,
        state,
        Arc::new(|app_handle, name, _namespaces, event_name| {
            K8sClusterResources::<RuntimeClass>::watch(app_handle, name, event_name)
        }),
    )
    .await
}

#[tauri::command]
pub async fn delete_runtime_classes(
    name: String,
    resource_names: Vec<String>,
) -> Result<Vec<Result<String, String>>, String> {
    Ok(K8sClusterResources::<RuntimeClass>::delete(name, resource_names).await?)
}
