use std::sync::Arc;

use crate::{
    commands::common::watch, services::k8s::resources::K8sResources, utils::watcher::WatchManager,
};
use k8s_openapi::api::batch::v1::Job;
use serde_json::Value;
use tauri::AppHandle;

#[tauri::command]
pub async fn list_jobs(
    name: String,
    namespaces: Option<Vec<String>>,
) -> Result<Vec<Value>, String> {
    K8sResources::<Job>::list(name, namespaces).await
}

#[tauri::command]
pub async fn watch_jobs(
    app_handle: AppHandle,
    name: String,
    namespaces: Option<Vec<String>>,
    state: tauri::State<'_, WatchManager>,
) -> Result<String, String> {
    watch(
        app_handle,
        name,
        "jobs".to_string(),
        namespaces,
        state,
        Arc::new(K8sResources::<Job>::watch),
    )
    .await
}

#[tauri::command]
pub async fn delete_jobs(
    name: String,
    namespace: Option<String>,
    resource_names: Vec<String>,
) -> Result<Vec<Result<String, String>>, String> {
    Ok(K8sResources::<Job>::delete(name, namespace, resource_names).await?)
}
