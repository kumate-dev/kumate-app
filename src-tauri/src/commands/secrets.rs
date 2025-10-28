use std::sync::Arc;

use crate::{
    commands::common::watch, services::k8s::resources::K8sResources, utils::watcher::WatchManager,
};
use k8s_openapi::api::core::v1::Secret;
use serde_json::Value;
use tauri::AppHandle;

#[tauri::command]
pub async fn list_secrets(
    name: String,
    namespaces: Option<Vec<String>>,
) -> Result<Vec<Value>, String> {
    K8sResources::<Secret>::list(name, namespaces).await
}

#[tauri::command]
pub async fn watch_secrets(
    app_handle: AppHandle,
    name: String,
    namespaces: Option<Vec<String>>,
    state: tauri::State<'_, WatchManager>,
) -> Result<String, String> {
    watch(
        app_handle,
        name,
        "secrets".to_string(),
        namespaces,
        state,
        Arc::new(K8sResources::<Secret>::watch),
    )
    .await
}

#[tauri::command]
pub async fn delete_secrets(
    name: String,
    namespace: Option<String>,
    resource_names: Vec<String>,
) -> Result<Vec<Result<String, String>>, String> {
    Ok(K8sResources::<Secret>::delete(name, namespace, resource_names).await?)
}
