use std::sync::Arc;

use crate::{
    commands::common::watch, manager::k8s::resources::K8sResources, utils::watcher::WatchManager,
};
use k8s_openapi::api::coordination::v1::Lease;
use serde_json::Value;
use tauri::AppHandle;

#[tauri::command]
pub async fn create_lease(
    name: String,
    namespace: Option<String>,
    manifest: Value,
) -> Result<Value, String> {
    K8sResources::<Lease>::create(name, namespace, manifest).await
}

#[tauri::command]
pub async fn update_lease(
    name: String,
    namespace: Option<String>,
    manifest: Value,
) -> Result<Value, String> {
    K8sResources::<Lease>::update(name, namespace, manifest).await
}

#[tauri::command]
pub async fn list_leases(
    name: String,
    namespaces: Option<Vec<String>>,
) -> Result<Vec<Value>, String> {
    K8sResources::<Lease>::list(name, namespaces).await
}

#[tauri::command]
pub async fn watch_leases(
    app_handle: AppHandle,
    name: String,
    namespaces: Option<Vec<String>>,
    state: tauri::State<'_, WatchManager>,
) -> Result<String, String> {
    watch(
        app_handle,
        name,
        "leases".to_string(),
        namespaces,
        state,
        Arc::new(K8sResources::<Lease>::watch),
    )
    .await
}

#[tauri::command]
pub async fn delete_leases(
    name: String,
    namespace: Option<String>,
    resource_names: Vec<String>,
) -> Result<Vec<Result<String, String>>, String> {
    Ok(K8sResources::<Lease>::delete(name, namespace, resource_names).await?)
}
