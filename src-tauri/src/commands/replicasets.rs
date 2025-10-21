use std::sync::Arc;

use crate::{
    commands::common::watch,
    k8s::replicasets::{K8sReplicaSets, ReplicaSetItem},
    utils::watcher::WatchManager,
};
use anyhow::Result;
use tauri::AppHandle;

#[tauri::command]
pub async fn list_replicasets(
    name: String,
    namespaces: Option<Vec<String>>,
) -> Result<Vec<ReplicaSetItem>, String> {
    K8sReplicaSets::list(name, namespaces).await
}

#[tauri::command]
pub async fn watch_replicasets(
    app_handle: AppHandle,
    name: String,
    namespaces: Option<Vec<String>>,
    state: tauri::State<'_, WatchManager>,
) -> Result<String, String> {
    watch(
        app_handle,
        name,
        "replicasets".to_string(),
        namespaces,
        state,
        Arc::new(K8sReplicaSets::watch),
    )
    .await
}
