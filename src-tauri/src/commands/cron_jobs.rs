use std::sync::Arc;

use crate::{
    commands::common::watch, services::k8s::resources::K8sResources, utils::watcher::WatchManager,
};
use k8s_openapi::api::batch::v1::CronJob;
use serde_json::Value;
use tauri::AppHandle;

#[tauri::command]
pub async fn create_cron_job(
    name: String,
    namespace: Option<String>,
    manifest: Value,
) -> Result<Value, String> {
    K8sResources::<CronJob>::create(name, namespace, manifest).await
}

#[tauri::command]
pub async fn update_cron_job(
    name: String,
    namespace: Option<String>,
    manifest: Value,
) -> Result<Value, String> {
    K8sResources::<CronJob>::update(name, namespace, manifest).await
}

#[tauri::command]
pub async fn list_cron_jobs(
    name: String,
    namespaces: Option<Vec<String>>, 
) -> Result<Vec<Value>, String> {
    K8sResources::<CronJob>::list(name, namespaces).await
}

#[tauri::command]
pub async fn watch_cron_jobs(
    app_handle: AppHandle,
    name: String,
    namespaces: Option<Vec<String>>,
    state: tauri::State<'_, WatchManager>,
) -> Result<String, String> {
    watch(
        app_handle,
        name,
        "cron_jobs".to_string(),
        namespaces,
        state,
        Arc::new(K8sResources::<CronJob>::watch),
    )
    .await
}

#[tauri::command]
pub async fn delete_cron_jobs(
    name: String,
    namespace: Option<String>,
    resource_names: Vec<String>,
) -> Result<Vec<Result<String, String>>, String> {
    Ok(K8sResources::<CronJob>::delete(name, namespace, resource_names).await?)
}
