use std::sync::Arc;

use crate::{
    commands::common::watch, manager::k8s::cluster_resources::K8sClusterResources,
    utils::watcher::WatchManager,
};
use k8s_openapi::api::admissionregistration::v1::ValidatingWebhookConfiguration;
use serde_json::Value;
use tauri::AppHandle;

#[tauri::command]
pub async fn create_validating_webhook(name: String, manifest: Value) -> Result<Value, String> {
    K8sClusterResources::<ValidatingWebhookConfiguration>::create(name, manifest).await
}

#[tauri::command]
pub async fn update_validating_webhook(name: String, manifest: Value) -> Result<Value, String> {
    K8sClusterResources::<ValidatingWebhookConfiguration>::update(name, manifest).await
}

#[tauri::command]
pub async fn list_validating_webhooks(name: String) -> Result<Vec<Value>, String> {
    K8sClusterResources::<ValidatingWebhookConfiguration>::list(name).await
}

#[tauri::command]
pub async fn watch_validating_webhooks(
    app_handle: AppHandle,
    name: String,
    state: tauri::State<'_, WatchManager>,
) -> Result<String, String> {
    watch(
        app_handle,
        name,
        "validating_webhooks".to_string(),
        None,
        state,
        Arc::new(|app_handle, name, _namespaces, event_name| {
            K8sClusterResources::<ValidatingWebhookConfiguration>::watch(
                app_handle, name, event_name,
            )
        }),
    )
    .await
}

#[tauri::command]
pub async fn delete_validating_webhooks(
    name: String,
    resource_names: Vec<String>,
) -> Result<Vec<Result<String, String>>, String> {
    Ok(K8sClusterResources::<ValidatingWebhookConfiguration>::delete(name, resource_names).await?)
}
