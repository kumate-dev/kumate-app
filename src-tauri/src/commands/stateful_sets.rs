use std::sync::Arc;

use crate::{
    commands::common::watch,
    services::k8s::stateful_sets::{K8sStatefulSets, StatefulSetItem},
    utils::watcher::WatchManager,
};
use anyhow::Result;
use tauri::AppHandle;

#[tauri::command]
pub async fn list_stateful_sets(
    name: String,
    namespaces: Option<Vec<String>>,
) -> Result<Vec<StatefulSetItem>, String> {
    K8sStatefulSets::list(name, namespaces).await
}

#[tauri::command]
pub async fn watch_stateful_sets(
    app_handle: AppHandle,
    name: String,
    namespaces: Option<Vec<String>>,
    state: tauri::State<'_, WatchManager>,
) -> Result<String, String> {
    watch(
        app_handle,
        name,
        "stateful_sets".to_string(),
        namespaces,
        state,
        Arc::new(K8sStatefulSets::watch),
    )
    .await
}
