use std::sync::Arc;

use crate::{
    commands::common::watch,
    k8s::jobs::{JobItem, K8sJobs},
    utils::watcher::WatchManager,
};
use anyhow::Result;
use tauri::AppHandle;

#[tauri::command]
pub async fn list_jobs(name: String, namespace: Option<String>) -> Result<Vec<JobItem>, String> {
    K8sJobs::list(name, namespace).await
}

#[tauri::command]
pub async fn watch_jobs(
    app_handle: AppHandle,
    name: String,
    namespace: Option<String>,
    state: tauri::State<'_, WatchManager>,
) -> Result<String, String> {
    watch(
        app_handle,
        name,
        "jobs".to_string(),
        namespace,
        state,
        Arc::new(K8sJobs::watch),
    )
    .await
}
