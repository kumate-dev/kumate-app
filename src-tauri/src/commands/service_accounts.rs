use std::sync::Arc;

use crate::{
    commands::common::watch, manager::k8s::resources::K8sResources, utils::watcher::WatchManager,
};
use k8s_openapi::api::core::v1::ServiceAccount;
use serde_json::Value;
use tauri::AppHandle;

#[tauri::command]
pub async fn create_service_account(
    name: String,
    namespace: Option<String>,
    manifest: Value,
) -> Result<Value, String> {
    K8sResources::<ServiceAccount>::create(name, namespace, manifest).await
}

#[tauri::command]
pub async fn update_service_account(
    name: String,
    namespace: Option<String>,
    manifest: Value,
) -> Result<Value, String> {
    K8sResources::<ServiceAccount>::update(name, namespace, manifest).await
}

#[tauri::command]
pub async fn list_service_accounts(
    name: String,
    namespaces: Option<Vec<String>>,
) -> Result<Vec<Value>, String> {
    K8sResources::<ServiceAccount>::list(name, namespaces).await
}

#[tauri::command]
pub async fn watch_service_accounts(
    app_handle: AppHandle,
    name: String,
    namespaces: Option<Vec<String>>,
    state: tauri::State<'_, WatchManager>,
) -> Result<String, String> {
    watch(
        app_handle,
        name,
        "service_accounts".to_string(),
        namespaces,
        state,
        Arc::new(K8sResources::<ServiceAccount>::watch),
    )
    .await
}

#[tauri::command]
pub async fn delete_service_accounts(
    name: String,
    namespace: Option<String>,
    resource_names: Vec<String>,
) -> Result<Vec<Result<String, String>>, String> {
    Ok(K8sResources::<ServiceAccount>::delete(name, namespace, resource_names).await?)
}
