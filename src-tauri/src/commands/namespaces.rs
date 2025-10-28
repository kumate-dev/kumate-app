use std::sync::Arc;

use crate::{
    commands::common::watch,
    services::k8s::namespaces::{K8sNamespaces, NamespaceItem},
    utils::watcher::WatchManager,
};
use anyhow::Result;
use tauri::AppHandle;

#[tauri::command]
pub async fn list_namespaces(name: String) -> Result<Vec<NamespaceItem>, String> {
    K8sNamespaces::list(name).await
}

#[tauri::command]
pub async fn watch_namespaces(
    app_handle: AppHandle,
    name: String,
    state: tauri::State<'_, WatchManager>,
) -> Result<String, String> {
    watch(
        app_handle,
        name,
        "namespaces".to_string(),
        None,
        state,
        Arc::new(|app_handle, name, _ns, event_name| {
            K8sNamespaces::watch(app_handle, name, event_name)
        }),
    )
    .await
}
