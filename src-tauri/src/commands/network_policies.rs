use std::sync::Arc;

use crate::{
    commands::common::watch, manager::k8s::resources::K8sResources, utils::watcher::WatchManager,
};
use k8s_openapi::api::networking::v1::NetworkPolicy;
use serde_json::Value;
use tauri::AppHandle;

#[tauri::command]
pub async fn create_network_policy(
    name: String,
    namespace: Option<String>,
    manifest: Value,
) -> Result<Value, String> {
    K8sResources::<NetworkPolicy>::create(name, namespace, manifest).await
}

#[tauri::command]
pub async fn update_network_policy(
    name: String,
    namespace: Option<String>,
    manifest: Value,
) -> Result<Value, String> {
    K8sResources::<NetworkPolicy>::update(name, namespace, manifest).await
}

#[tauri::command]
pub async fn list_network_policies(
    name: String,
    namespaces: Option<Vec<String>>,
) -> Result<Vec<Value>, String> {
    K8sResources::<NetworkPolicy>::list(name, namespaces).await
}

#[tauri::command]
pub async fn watch_network_policies(
    app_handle: AppHandle,
    name: String,
    namespaces: Option<Vec<String>>,
    state: tauri::State<'_, WatchManager>,
) -> Result<String, String> {
    watch(
        app_handle,
        name,
        "network_policies".to_string(),
        namespaces,
        state,
        Arc::new(K8sResources::<NetworkPolicy>::watch),
    )
    .await
}

#[tauri::command]
pub async fn delete_network_policies(
    name: String,
    namespace: Option<String>,
    resource_names: Vec<String>,
) -> Result<Vec<Result<String, String>>, String> {
    Ok(K8sResources::<NetworkPolicy>::delete(name, namespace, resource_names).await?)
}
