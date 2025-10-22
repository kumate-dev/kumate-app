use std::sync::Arc;

use crate::{
    commands::common::watch,
    k8s::configmaps::{ConfigMapItem, K8sConfigMaps},
    utils::watcher::WatchManager,
};
use anyhow::Result;
use tauri::AppHandle;

#[tauri::command]
pub async fn list_configmaps(
    name: String,
    namespaces: Option<Vec<String>>,
) -> Result<Vec<ConfigMapItem>, String> {
    K8sConfigMaps::list(name, namespaces).await
}

#[tauri::command]
pub async fn watch_configmaps(
    app_handle: AppHandle,
    name: String,
    namespaces: Option<Vec<String>>,
    state: tauri::State<'_, WatchManager>,
) -> Result<String, String> {
    watch(
        app_handle,
        name,
        "configmaps".to_string(),
        namespaces,
        state,
        Arc::new(K8sConfigMaps::watch),
    )
    .await
}
