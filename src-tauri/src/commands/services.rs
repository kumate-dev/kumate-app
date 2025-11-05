use std::sync::Arc;

use crate::{
    commands::common::watch, manager::k8s::resources::K8sResources, utils::watcher::WatchManager,
};
use k8s_openapi::api::core::v1::Service;
use serde_json::Value;
use tauri::AppHandle;

#[tauri::command]
pub async fn create_service(
    name: String,
    namespace: Option<String>,
    manifest: Value,
) -> Result<Value, String> {
    K8sResources::<Service>::create(name, namespace, manifest).await
}

#[tauri::command]
pub async fn update_service(
    name: String,
    namespace: Option<String>,
    manifest: Value,
) -> Result<Value, String> {
    K8sResources::<Service>::update(name, namespace, manifest).await
}

#[tauri::command]
pub async fn list_services(
    name: String,
    namespaces: Option<Vec<String>>,
) -> Result<Vec<Value>, String> {
    K8sResources::<Service>::list(name, namespaces).await
}

#[tauri::command]
pub async fn watch_services(
    app_handle: AppHandle,
    name: String,
    namespaces: Option<Vec<String>>,
    state: tauri::State<'_, WatchManager>,
) -> Result<String, String> {
    watch(
        app_handle,
        name,
        "services".to_string(),
        namespaces,
        state,
        Arc::new(K8sResources::<Service>::watch),
    )
    .await
}

#[tauri::command]
pub async fn delete_services(
    name: String,
    namespace: Option<String>,
    resource_names: Vec<String>,
) -> Result<Vec<Result<String, String>>, String> {
    Ok(K8sResources::<Service>::delete(name, namespace, resource_names).await?)
}
