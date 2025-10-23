use std::sync::Arc;

use crate::{
    commands::common::watch,
    k8s::pods::{K8sPods, PodItem},
    utils::watcher::WatchManager,
};
use anyhow::Result;
use tauri::AppHandle;

#[tauri::command]
pub async fn list_pods(
    name: String,
    namespaces: Option<Vec<String>>,
) -> Result<Vec<PodItem>, String> {
    K8sPods::list(name, namespaces).await
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
        Arc::new(K8sPods::watch),
    )
    .await
}

#[tauri::command]
pub async fn delete_pods(
    name: String,
    namespace: Option<String>,
    pod_names: Vec<String>,
) -> Result<Vec<PodItem>, String> {
    let pods: Vec<PodItem> =
        K8sPods::list(name.clone(), namespace.clone().map(|n| vec![n.clone()]))
            .await?
            .into_iter()
            .filter(|p| pod_names.contains(&p.name))
            .collect();

    let _deleted_names: Vec<String> = K8sPods::delete(name.clone(), namespace, pod_names).await?;

    Ok(pods)
}
