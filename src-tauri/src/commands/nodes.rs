use std::sync::Arc;

use crate::{
    commands::common::watch,
    k8s::nodes::{K8sNodes, NodeItem},
    utils::watcher::WatchManager,
};
use anyhow::Result;
use tauri::AppHandle;

#[tauri::command]
pub async fn list_nodes(name: String) -> Result<Vec<NodeItem>, String> {
    K8sNodes::list(name).await
}

#[tauri::command]
pub async fn watch_nodes(
    app_handle: AppHandle,
    name: String,
    state: tauri::State<'_, WatchManager>,
) -> Result<String, String> {
    watch(
        app_handle,
        name,
        "nodes".to_string(),
        None,
        state,
        Arc::new(|app_handle, name, _ns, event_name| K8sNodes::watch(app_handle, name, event_name)),
    )
    .await
}
