use crate::commands::common::watch as watch_common;
use crate::manager::k8s::helm::HelmManager;
use crate::utils::watcher::WatchManager;
use serde_json::Value;
use std::sync::Arc;
use tauri::AppHandle;

#[tauri::command]
pub async fn helm_list_releases(
    name: String,
    namespaces: Option<Vec<String>>,
) -> Result<Vec<Value>, String> {
    HelmManager::list_releases(name, namespaces).await
}

#[tauri::command]
pub async fn helm_uninstall_releases(
    name: String,
    namespace: Option<String>,
    release_names: Vec<String>,
) -> Result<Vec<Result<String, String>>, String> {
    HelmManager::uninstall_releases(name, namespace, release_names).await
}

#[tauri::command]
pub async fn helm_list_charts(name: String) -> Result<Vec<Value>, String> {
    HelmManager::list_charts(name).await
}

#[tauri::command]
pub async fn watch_helm_releases(
    app_handle: AppHandle,
    name: String,
    namespaces: Option<Vec<String>>,
    state: tauri::State<'_, WatchManager>,
) -> Result<String, String> {
    let watch_fn = Arc::new(
        |app_handle: AppHandle,
         name: String,
         namespaces: Option<Vec<String>>,
         event_name: String| async move {
            HelmManager::watch_releases(app_handle, name, namespaces, event_name).await
        },
    );

    watch_common(app_handle, name, "helm_releases".to_string(), namespaces, state, watch_fn).await
}
