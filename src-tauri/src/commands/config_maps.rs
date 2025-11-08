use std::sync::Arc;

use crate::{
    commands::common::watch, manager::k8s::resources::K8sResources, utils::watcher::WatchManager,
};
use k8s_openapi::api::core::v1::ConfigMap;
use serde_json::Value;
use tauri::AppHandle;

#[tauri::command]
pub async fn create_config_map(
    name: String,
    namespace: Option<String>,
    manifest: Value,
) -> Result<Value, String> {
    K8sResources::<ConfigMap>::create(name, namespace, manifest).await
}

#[tauri::command]
pub async fn update_config_map(
    name: String,
    namespace: Option<String>,
    manifest: Value,
) -> Result<Value, String> {
    K8sResources::<ConfigMap>::update(name, namespace, manifest).await
}

#[tauri::command]
pub async fn list_config_maps(
    name: String,
    namespaces: Option<Vec<String>>,
) -> Result<Vec<Value>, String> {
    K8sResources::<ConfigMap>::list(name, namespaces).await
}

#[tauri::command]
pub async fn watch_config_maps(
    app_handle: AppHandle,
    name: String,
    namespaces: Option<Vec<String>>,
    state: tauri::State<'_, WatchManager>,
) -> Result<String, String> {
    watch(
        app_handle,
        name,
        "config_maps".to_string(),
        namespaces,
        state,
        Arc::new(K8sResources::<ConfigMap>::watch),
    )
    .await
}

#[tauri::command]
pub async fn delete_config_maps(
    name: String,
    namespace: Option<String>,
    resource_names: Vec<String>,
) -> Result<Vec<Result<String, String>>, String> {
    Ok(K8sResources::<ConfigMap>::delete(name, namespace, resource_names).await?)
}
