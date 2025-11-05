use std::sync::Arc;

use crate::{
    commands::common::watch, services::k8s::resources::K8sResources, utils::watcher::WatchManager,
};
use k8s_openapi::api::apps::v1::DaemonSet;
use serde_json::Value;
use tauri::AppHandle;

#[tauri::command]
pub async fn create_daemon_set(
    name: String,
    namespace: Option<String>,
    manifest: Value,
) -> Result<Value, String> {
    K8sResources::<DaemonSet>::create(name, namespace, manifest).await
}

#[tauri::command]
pub async fn update_daemon_set(
    name: String,
    namespace: Option<String>,
    manifest: Value,
) -> Result<Value, String> {
    K8sResources::<DaemonSet>::update(name, namespace, manifest).await
}

#[tauri::command]
pub async fn list_daemon_sets(
    name: String,
    namespaces: Option<Vec<String>>, 
) -> Result<Vec<Value>, String> {
    K8sResources::<DaemonSet>::list(name, namespaces).await
}

#[tauri::command]
pub async fn watch_daemon_sets(
    app_handle: AppHandle,
    name: String,
    namespaces: Option<Vec<String>>,
    state: tauri::State<'_, WatchManager>,
) -> Result<String, String> {
    watch(
        app_handle,
        name,
        "daemon_sets".to_string(),
        namespaces,
        state,
        Arc::new(K8sResources::<DaemonSet>::watch),
    )
    .await
}

#[tauri::command]
pub async fn delete_daemon_sets(
    name: String,
    namespace: Option<String>,
    resource_names: Vec<String>,
) -> Result<Vec<Result<String, String>>, String> {
    Ok(K8sResources::<DaemonSet>::delete(name, namespace, resource_names).await?)
}
