use std::sync::Arc;

use crate::{
    commands::common::watch,
    k8s::cron_jobs::{CronJobItem, K8sCronJobs},
    utils::watcher::WatchManager,
};
use anyhow::Result;
use tauri::AppHandle;

#[tauri::command]
pub async fn list_cron_jobs(
    name: String,
    namespaces: Option<Vec<String>>,
) -> Result<Vec<CronJobItem>, String> {
    K8sCronJobs::list(name, namespaces).await
}

#[tauri::command]
pub async fn watch_cron_jobs(
    app_handle: AppHandle,
    name: String,
    namespaces: Option<Vec<String>>,
    state: tauri::State<'_, WatchManager>,
) -> Result<String, String> {
    watch(
        app_handle,
        name,
        "cron_jobs".to_string(),
        namespaces,
        state,
        Arc::new(K8sCronJobs::watch),
    )
    .await
}
