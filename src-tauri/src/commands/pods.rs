use std::sync::Arc;

use crate::{
    commands::common::watch,
    k8s::pods::{K8sPods, PodItem},
    utils::watcher::WatchManager,
};
use anyhow::Result;
use tauri::AppHandle;

#[tauri::command]
pub async fn list_pods(name: String, namespace: Option<String>) -> Result<Vec<PodItem>, String> {
    K8sPods::list(name, namespace).await
}

#[tauri::command]
pub async fn watch_pods(
    app_handle: AppHandle,
    name: String,
    namespace: Option<String>,
    state: tauri::State<'_, WatchManager>,
) -> Result<String, String> {
    watch(
        app_handle,
        name,
        "pods".to_string(),
        namespace,
        state,
        Arc::new(K8sPods::watch),
    )
    .await
}
