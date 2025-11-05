use std::sync::Arc;

use crate::{
    commands::common::watch, manager::k8s::cluster_resources::K8sClusterResources,
    utils::watcher::WatchManager,
};
use k8s_openapi::api::admissionregistration::v1::MutatingWebhookConfiguration;
use serde_json::Value;
use tauri::AppHandle;

#[tauri::command]
pub async fn create_mutating_webhook(name: String, manifest: Value) -> Result<Value, String> {
    K8sClusterResources::<MutatingWebhookConfiguration>::create(name, manifest).await
}

#[tauri::command]
pub async fn update_mutating_webhook(name: String, manifest: Value) -> Result<Value, String> {
    K8sClusterResources::<MutatingWebhookConfiguration>::update(name, manifest).await
}

#[tauri::command]
pub async fn list_mutating_webhooks(name: String) -> Result<Vec<Value>, String> {
    K8sClusterResources::<MutatingWebhookConfiguration>::list(name).await
}

#[tauri::command]
pub async fn watch_mutating_webhooks(
    app_handle: AppHandle,
    name: String,
    state: tauri::State<'_, WatchManager>,
) -> Result<String, String> {
    watch(
        app_handle,
        name,
        "mutating_webhooks".to_string(),
        None,
        state,
        Arc::new(|app_handle, name, _namespaces, event_name| {
            K8sClusterResources::<MutatingWebhookConfiguration>::watch(app_handle, name, event_name)
        }),
    )
    .await
}

#[tauri::command]
pub async fn delete_mutating_webhooks(
    name: String,
    resource_names: Vec<String>,
) -> Result<Vec<Result<String, String>>, String> {
    Ok(K8sClusterResources::<MutatingWebhookConfiguration>::delete(name, resource_names).await?)
}
