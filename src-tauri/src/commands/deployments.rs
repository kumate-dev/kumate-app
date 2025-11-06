use std::sync::Arc;

use crate::{
    commands::common::watch, manager::k8s::resources::K8sResources, utils::watcher::WatchManager,
};
use k8s_openapi::api::apps::v1::Deployment;
use k8s_openapi::chrono;
use serde_json::Value;
use tauri::AppHandle;

#[tauri::command]
pub async fn create_deployment(
    name: String,
    namespace: Option<String>,
    manifest: Value,
) -> Result<Value, String> {
    K8sResources::<Deployment>::create(name, namespace, manifest).await
}

#[tauri::command]
pub async fn update_deployment(
    name: String,
    namespace: Option<String>,
    manifest: Value,
) -> Result<Value, String> {
    K8sResources::<Deployment>::update(name, namespace, manifest).await
}

#[tauri::command]
pub async fn list_deployments(
    name: String,
    namespaces: Option<Vec<String>>,
) -> Result<Vec<Value>, String> {
    K8sResources::<Deployment>::list(name, namespaces).await
}

#[tauri::command]
pub async fn watch_deployments(
    app_handle: AppHandle,
    name: String,
    namespaces: Option<Vec<String>>,
    state: tauri::State<'_, WatchManager>,
) -> Result<String, String> {
    watch(
        app_handle,
        name,
        "deployments".to_string(),
        namespaces,
        state,
        Arc::new(K8sResources::<Deployment>::watch),
    )
    .await
}

#[tauri::command]
pub async fn delete_deployments(
    name: String,
    namespace: Option<String>,
    resource_names: Vec<String>,
) -> Result<Vec<Result<String, String>>, String> {
    Ok(K8sResources::<Deployment>::delete(name, namespace, resource_names).await?)
}

#[tauri::command]
pub async fn restart_deployment(
    name: String,
    namespace: Option<String>,
    resource_name: String,
) -> Result<Value, String> {
    let patch: Value = serde_json::json!({
        "spec": {
            "template": {
                "metadata": {
                    "annotations": {
                        "kumate.dev/restartedAt": chrono::Utc::now().to_rfc3339()
                    }
                }
            }
        }
    });

    K8sResources::<Deployment>::patch(name, namespace, resource_name, patch, "merge".into()).await
}

#[tauri::command]
pub async fn scale_deployment(
    name: String,
    namespace: Option<String>,
    resource_name: String,
    replicas: i32,
) -> Result<Value, String> {
    let patch: Value = serde_json::json!({
        "spec": { "replicas": replicas }
    });

    K8sResources::<Deployment>::patch(name, namespace, resource_name, patch, "merge".into()).await
}
