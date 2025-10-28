use std::sync::Arc;

use crate::{
    commands::common::watch,
    services::k8s::horizontal_pod_autoscalers::{HorizontalPodAutoscalerItem, K8sHorizontalPodAutoscalers},
    utils::watcher::WatchManager,
};
use anyhow::Result;
use tauri::AppHandle;

#[tauri::command]
pub async fn list_horizontal_pod_autoscalers(
    name: String,
    namespaces: Option<Vec<String>>,
) -> Result<Vec<HorizontalPodAutoscalerItem>, String> {
    K8sHorizontalPodAutoscalers::list(name, namespaces).await
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
        Arc::new(K8sHorizontalPodAutoscalers::watch),
    )
    .await
}
