use std::sync::Arc;

use crate::{
    commands::common::watch, manager::k8s::resources::K8sResources, utils::watcher::WatchManager,
};
use k8s_openapi::api::autoscaling::v1::HorizontalPodAutoscaler;
use serde_json::Value;
use tauri::AppHandle;

#[tauri::command]
pub async fn create_horizontal_pod_autoscaler(
    name: String,
    namespace: Option<String>,
    manifest: Value,
) -> Result<Value, String> {
    K8sResources::<HorizontalPodAutoscaler>::create(name, namespace, manifest).await
}

#[tauri::command]
pub async fn update_horizontal_pod_autoscaler(
    name: String,
    namespace: Option<String>,
    manifest: Value,
) -> Result<Value, String> {
    K8sResources::<HorizontalPodAutoscaler>::update(name, namespace, manifest).await
}

#[tauri::command]
pub async fn list_horizontal_pod_autoscalers(
    name: String,
    namespaces: Option<Vec<String>>,
) -> Result<Vec<Value>, String> {
    K8sResources::<HorizontalPodAutoscaler>::list(name, namespaces).await
}

#[tauri::command]
pub async fn watch_horizontal_pod_autoscalers(
    app_handle: AppHandle,
    name: String,
    namespaces: Option<Vec<String>>,
    state: tauri::State<'_, WatchManager>,
) -> Result<String, String> {
    watch(
        app_handle,
        name,
        "horizontal_pod_autoscalers".to_string(),
        namespaces,
        state,
        Arc::new(K8sResources::<HorizontalPodAutoscaler>::watch),
    )
    .await
}

#[tauri::command]
pub async fn delete_horizontal_pod_autoscalers(
    name: String,
    namespace: Option<String>,
    resource_names: Vec<String>,
) -> Result<Vec<Result<String, String>>, String> {
    Ok(K8sResources::<HorizontalPodAutoscaler>::delete(name, namespace, resource_names).await?)
}
