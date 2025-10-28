use std::sync::Arc;

use crate::{
    commands::common::watch,
    services::k8s::replica_sets::{K8sReplicaSets, ReplicaSetItem},
    utils::watcher::WatchManager,
};
use anyhow::Result;
use tauri::AppHandle;

#[tauri::command]
pub async fn list_replica_sets(
    name: String,
    namespaces: Option<Vec<String>>,
) -> Result<Vec<ReplicaSetItem>, String> {
    K8sReplicaSets::list(name, namespaces).await
}

#[tauri::command]
pub async fn watch_replica_sets(
    app_handle: AppHandle,
    name: String,
    namespaces: Option<Vec<String>>,
    state: tauri::State<'_, WatchManager>,
) -> Result<String, String> {
    watch(
        app_handle,
        name,
        "replica_sets".to_string(),
        namespaces,
        state,
        Arc::new(K8sReplicaSets::watch),
    )
    .await
}
