use std::sync::Arc;

use crate::{
    commands::common::watch,
    k8s::cronjobs::{CronJobItem, K8sCronJobs},
    utils::watcher::WatchManager,
};
use anyhow::Result;
use tauri::AppHandle;

#[tauri::command]
pub async fn list_cronjobs(
    name: String,
    namespace: Option<String>,
) -> Result<Vec<CronJobItem>, String> {
    K8sCronJobs::list(name, namespace).await
}

#[tauri::command]
pub async fn watch_cronjobs(
    app_handle: AppHandle,
    name: String,
    namespace: Option<String>,
    state: tauri::State<'_, WatchManager>,
) -> Result<String, String> {
    watch(
        app_handle,
        name,
        "cronjobs".to_string(),
        namespace,
        state,
        Arc::new(K8sCronJobs::watch),
    )
    .await
}
