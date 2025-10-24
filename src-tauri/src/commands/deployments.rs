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
    namespaces: Option<Vec<String>>,
) -> Result<Vec<DeploymentItem>, String> {
    K8sDeployments::list(name, namespaces).await
}

#[tauri::command]
pub async fn watch_deployments(
    app_handle: AppHandle,
    name: String,
    namespaces: Option<Vec<String>>,
    state: tauri::State<'_, WatchManager>,
) -> Result<String, String> {
    watch(
        app_handle,
        name,
        "deployments".to_string(),
        namespaces,
        state,
        Arc::new(K8sDeployments::watch),
    )
    .await
}

#[tauri::command]
pub async fn delete_deployments(
    name: String,
    namespace: Option<String>,
    resource_names: Vec<String>,
) -> Result<Vec<Result<String, String>>, String> {
    Ok(K8sDeployments::delete(name, namespace, resource_names).await?)
}
