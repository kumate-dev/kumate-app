use std::sync::Arc;

use crate::{
    commands::common::watch,
    k8s::replicationcontrollers::{K8sReplicationControllers, ReplicationControllerItem},
    utils::watcher::WatchManager,
};
use anyhow::Result;
use tauri::AppHandle;

#[tauri::command]
pub async fn list_replicationcontrollers(
    name: String,
    namespace: Option<String>,
) -> Result<Vec<ReplicationControllerItem>, String> {
    K8sReplicationControllers::list(name, namespace).await
}

#[tauri::command]
pub async fn watch_replicationcontrollers(
    app_handle: AppHandle,
    name: String,
    namespace: Option<String>,
    state: tauri::State<'_, WatchManager>,
) -> Result<String, String> {
    watch(
        app_handle,
        name,
        "replicationcontrollers".to_string(),
        namespace,
        state,
        Arc::new(K8sReplicationControllers::watch),
    )
    .await
}
