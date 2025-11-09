use std::sync::Arc;

use crate::{
    commands::common::watch, manager::k8s::resources::K8sResources, utils::watcher::WatchManager,
};
use k8s_openapi::api::core::v1::ResourceQuota;
use serde_json::Value;
use tauri::AppHandle;

#[tauri::command]
pub async fn create_resource_quota(
    name: String,
    namespace: Option<String>,
    manifest: Value,
) -> Result<Value, String> {
    K8sResources::<ResourceQuota>::create(name, namespace, manifest).await
}

#[tauri::command]
pub async fn update_resource_quota(
    name: String,
    namespace: Option<String>,
    manifest: Value,
) -> Result<Value, String> {
    K8sResources::<ResourceQuota>::update(name, namespace, manifest).await
}

#[tauri::command]
pub async fn list_resource_quotas(
    name: String,
    namespaces: Option<Vec<String>>,
) -> Result<Vec<Value>, String> {
    K8sResources::<ResourceQuota>::list(name, namespaces).await
}

#[tauri::command]
pub async fn watch_resource_quotas(
    app_handle: AppHandle,
    name: String,
    namespaces: Option<Vec<String>>,
    state: tauri::State<'_, WatchManager>,
) -> Result<String, String> {
    watch(
        app_handle,
        name,
        "resource_quotas".to_string(),
        namespaces,
        state,
        Arc::new(K8sResources::<ResourceQuota>::watch),
    )
    .await
}

#[tauri::command]
pub async fn delete_resource_quotas(
    name: String,
    namespace: Option<String>,
    resource_names: Vec<String>,
) -> Result<Vec<Result<String, String>>, String> {
    Ok(K8sResources::<ResourceQuota>::delete(name, namespace, resource_names).await?)
}
