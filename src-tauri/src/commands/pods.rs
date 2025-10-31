use std::sync::Arc;

use crate::{
    commands::common::watch,
    services::k8s::{pod_resources::PodResources, resources::K8sResources},
    utils::watcher::WatchManager,
};
use k8s_openapi::api::core::v1::Pod;
use serde_json::Value;
use tauri::AppHandle;

#[tauri::command]
pub async fn create_pod(
    name: String,
    namespace: Option<String>,
    manifest: Value,
) -> Result<Value, String> {
    K8sResources::<Pod>::create(name, namespace, manifest).await
}

#[tauri::command]
pub async fn update_pod(
    name: String,
    namespace: Option<String>,
    manifest: Value,
) -> Result<Value, String> {
    K8sResources::<Pod>::update(name, namespace, manifest).await
}

#[tauri::command]
pub async fn list_pods(
    name: String,
    namespaces: Option<Vec<String>>,
) -> Result<Vec<Value>, String> {
    K8sResources::<Pod>::list(name, namespaces).await
}

#[tauri::command]
pub async fn watch_pods(
    app_handle: AppHandle,
    name: String,
    namespaces: Option<Vec<String>>,
    state: tauri::State<'_, WatchManager>,
) -> Result<String, String> {
    watch(
        app_handle,
        name,
        "pods".to_string(),
        namespaces,
        state,
        Arc::new(K8sResources::<Pod>::watch),
    )
    .await
}

#[tauri::command]
pub async fn delete_pods(
    name: String,
    namespace: Option<String>,
    resource_names: Vec<String>,
) -> Result<Vec<Result<String, String>>, String> {
    Ok(K8sResources::<Pod>::delete(name, namespace, resource_names).await?)
}

#[tauri::command]
pub async fn get_pod_logs(
    context: String,
    namespace: String,
    pod_name: String,
    container_name: Option<String>,
    tail_lines: Option<i64>,
) -> Result<String, String> {
    PodResources::get_logs(context, namespace, pod_name, container_name, tail_lines).await
}

#[tauri::command]
pub async fn watch_pod_logs(
    app_handle: AppHandle,
    context: String,
    namespace: String,
    pod_name: String,
    container_name: Option<String>,
    event_name: String,
    tail_lines: Option<i64>,
) -> Result<(), String> {
    PodResources::watch_logs(
        app_handle,
        context,
        namespace,
        pod_name,
        container_name,
        event_name,
        tail_lines,
    )
    .await
}
