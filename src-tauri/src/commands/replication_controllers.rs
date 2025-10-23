use std::sync::Arc;

use crate::{
    commands::common::watch,
    k8s::replication_controllers::{K8sReplicationControllers, ReplicationControllerItem},
    utils::watcher::WatchManager,
};
use anyhow::Result;
use tauri::AppHandle;

#[tauri::command]
pub async fn list_replication_controllers(
    name: String,
    namespaces: Option<Vec<String>>,
) -> Result<Vec<ReplicationControllerItem>, String> {
    K8sReplicationControllers::list(name, namespaces).await
}

#[tauri::command]
pub async fn watch_replication_controllers(
    app_handle: AppHandle,
    name: String,
    namespaces: Option<Vec<String>>,
    state: tauri::State<'_, WatchManager>,
) -> Result<String, String> {
    watch(
        app_handle,
        name,
        "replication_controllers".to_string(),
        namespaces,
        state,
        Arc::new(K8sReplicationControllers::watch),
    )
    .await
}
