use std::sync::Arc;

use anyhow::Result;
use tauri::AppHandle;

use crate::{
    commands::common::watch,
    k8s::daemon_sets::{DaemonSetItem, K8sDaemonSets},
    utils::watcher::WatchManager,
};

#[tauri::command]
pub async fn list_daemonsets(
    name: String,
    namespaces: Option<Vec<String>>,
) -> Result<Vec<DaemonSetItem>, String> {
    K8sDaemonSets::list(name, namespaces).await
}

#[tauri::command]
pub async fn watch_daemonsets(
    app_handle: AppHandle,
    name: String,
    namespaces: Option<Vec<String>>,
    state: tauri::State<'_, WatchManager>,
) -> Result<String, String> {
    watch(
        app_handle,
        name,
        "daemonsets".to_string(),
        namespaces,
        state,
        Arc::new(K8sDaemonSets::watch),
    )
    .await
}
