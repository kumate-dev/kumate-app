use std::sync::Arc;

use crate::{
    commands::common::watch,
    services::k8s::config_maps::{ConfigMapItem, K8sConfigMaps},
    utils::watcher::WatchManager,
};
use anyhow::Result;
use tauri::AppHandle;

#[tauri::command]
pub async fn list_config_maps(
    name: String,
    namespaces: Option<Vec<String>>,
) -> Result<Vec<ConfigMapItem>, String> {
    K8sConfigMaps::list(name, namespaces).await
}

#[tauri::command]
pub async fn watch_config_maps(
    app_handle: AppHandle,
    name: String,
    namespaces: Option<Vec<String>>,
    state: tauri::State<'_, WatchManager>,
) -> Result<String, String> {
    watch(
        app_handle,
        name,
        "config_maps".to_string(),
        namespaces,
        state,
        Arc::new(K8sConfigMaps::watch),
    )
    .await
}
