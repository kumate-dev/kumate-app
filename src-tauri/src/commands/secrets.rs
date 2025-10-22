use std::sync::Arc;

use crate::{
    commands::common::watch,
    k8s::secrets::{K8sSecrets, SecretItem},
    utils::watcher::WatchManager,
};
use anyhow::Result;
use tauri::AppHandle;

#[tauri::command]
pub async fn list_secrets(
    name: String,
    namespaces: Option<Vec<String>>,
) -> Result<Vec<SecretItem>, String> {
    K8sSecrets::list(name, namespaces).await
}

#[tauri::command]
pub async fn watch_secrets(
    app_handle: AppHandle,
    name: String,
    namespaces: Option<Vec<String>>,
    state: tauri::State<'_, WatchManager>,
) -> Result<String, String> {
    watch(
        app_handle,
        name,
        "secrets".to_string(),
        namespaces,
        state,
        Arc::new(K8sSecrets::watch),
    )
    .await
}
