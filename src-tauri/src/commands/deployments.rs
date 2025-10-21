use crate::{
    commands::common::watch,
    k8s::deployments::{DeploymentItem, K8sDeployments},
    utils::watcher::WatchManager,
};
use anyhow::Result;
use std::sync::Arc;
use tauri::AppHandle;

#[tauri::command]
pub async fn list_deployments(
    name: String,
    namespace: Option<String>,
) -> Result<Vec<DeploymentItem>, String> {
    K8sDeployments::list(name, namespace).await
}

#[tauri::command]
pub async fn watch_deployments(
    app_handle: AppHandle,
    name: String,
    namespace: Option<String>,
    state: tauri::State<'_, WatchManager>,
) -> Result<String, String> {
    watch(
        app_handle,
        name,
        "deployments".to_string(),
        namespace,
        state,
        Arc::new(K8sDeployments::watch),
    )
    .await
}
