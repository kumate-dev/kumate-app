use std::sync::Arc;

use crate::{
    commands::common::watch, manager::k8s::resources::K8sResources, utils::watcher::WatchManager,
};
use k8s_openapi::api::core::v1::LimitRange;
use serde_json::Value;
use tauri::AppHandle;

#[tauri::command]
pub async fn create_limit_range(
    name: String,
    namespace: Option<String>,
    manifest: Value,
) -> Result<Value, String> {
    K8sResources::<LimitRange>::create(name, namespace, manifest).await
}

#[tauri::command]
pub async fn update_limit_range(
    name: String,
    namespace: Option<String>,
    manifest: Value,
) -> Result<Value, String> {
    K8sResources::<LimitRange>::update(name, namespace, manifest).await
}

#[tauri::command]
pub async fn list_limit_ranges(
    name: String,
    namespaces: Option<Vec<String>>,
) -> Result<Vec<Value>, String> {
    K8sResources::<LimitRange>::list(name, namespaces).await
}

#[tauri::command]
pub async fn watch_limit_ranges(
    app_handle: AppHandle,
    name: String,
    namespaces: Option<Vec<String>>,
    state: tauri::State<'_, WatchManager>,
) -> Result<String, String> {
    watch(
        app_handle,
        name,
        "limit_ranges".to_string(),
        namespaces,
        state,
        Arc::new(K8sResources::<LimitRange>::watch),
    )
    .await
}

#[tauri::command]
pub async fn delete_limit_ranges(
    name: String,
    namespace: Option<String>,
    resource_names: Vec<String>,
) -> Result<Vec<Result<String, String>>, String> {
    Ok(K8sResources::<LimitRange>::delete(name, namespace, resource_names).await?)
}
