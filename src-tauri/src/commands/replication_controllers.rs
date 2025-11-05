use std::sync::Arc;

use crate::{
    commands::common::watch, services::k8s::resources::K8sResources, utils::watcher::WatchManager,
};
use k8s_openapi::api::core::v1::ReplicationController;
use serde_json::Value;
use tauri::AppHandle;

#[tauri::command]
pub async fn create_replication_controller(
    name: String,
    namespace: Option<String>,
    manifest: Value,
) -> Result<Value, String> {
    K8sResources::<ReplicationController>::create(name, namespace, manifest).await
}

#[tauri::command]
pub async fn update_replication_controller(
    name: String,
    namespace: Option<String>,
    manifest: Value,
) -> Result<Value, String> {
    K8sResources::<ReplicationController>::update(name, namespace, manifest).await
}

#[tauri::command]
pub async fn list_replication_controllers(
    name: String,
    namespaces: Option<Vec<String>>,
) -> Result<Vec<Value>, String> {
    K8sResources::<ReplicationController>::list(name, namespaces).await
}

#[tauri::command]
pub async fn watch_replication_controllers(
    app_handle: AppHandle,
    name: String,
    namespaces: Option<Vec<String>>,
    state: tauri::State<'_, WatchManager>,
) -> Result<String, String> {
    watch(
        app_handle,
        name,
        "replication_controllers".to_string(),
        namespaces,
        state,
        Arc::new(K8sResources::<ReplicationController>::watch),
    )
    .await
}

#[tauri::command]
pub async fn delete_replication_controllers(
    name: String,
    namespace: Option<String>,
    resource_names: Vec<String>,
) -> Result<Vec<Result<String, String>>, String> {
    Ok(K8sResources::<ReplicationController>::delete(name, namespace, resource_names).await?)
}
