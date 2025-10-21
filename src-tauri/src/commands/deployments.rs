use crate::{
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
    let ns: String = namespace.unwrap_or_else(|| "default".to_string());
    let event_name: Arc<String> = Arc::new(format!("k8s://{}/deployments/{}", name, ns));
    let event_name_clone: Arc<String> = Arc::clone(&event_name);
    state
        .watch(app_handle, name.clone(), move |app_handle, name| {
            let event_name_inner = Arc::clone(&event_name_clone);
            let ns_inner = ns.clone();
            async move {
                K8sDeployments::watch(
                    app_handle,
                    name,
                    Some(ns_inner),
                    event_name_inner.to_string(),
                )
                .await
            }
        })
        .await?;

    Ok(event_name.to_string())
}
