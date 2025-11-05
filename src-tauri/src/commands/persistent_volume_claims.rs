use std::sync::Arc;

use crate::{
    commands::common::watch, manager::k8s::resources::K8sResources, utils::watcher::WatchManager,
};
use k8s_openapi::api::core::v1::PersistentVolumeClaim;
use serde_json::Value;
use tauri::AppHandle;

#[tauri::command]
pub async fn create_persistent_volume_claim(
    name: String,
    namespace: Option<String>,
    manifest: Value,
) -> Result<Value, String> {
    K8sResources::<PersistentVolumeClaim>::create(name, namespace, manifest).await
}

#[tauri::command]
pub async fn update_persistent_volume_claim(
    name: String,
    namespace: Option<String>,
    manifest: Value,
) -> Result<Value, String> {
    K8sResources::<PersistentVolumeClaim>::update(name, namespace, manifest).await
}

#[tauri::command]
pub async fn list_persistent_volume_claims(
    name: String,
    namespaces: Option<Vec<String>>,
) -> Result<Vec<Value>, String> {
    K8sResources::<PersistentVolumeClaim>::list(name, namespaces).await
}

#[tauri::command]
pub async fn watch_persistent_volume_claims(
    app_handle: AppHandle,
    name: String,
    namespaces: Option<Vec<String>>,
    state: tauri::State<'_, WatchManager>,
) -> Result<String, String> {
    watch(
        app_handle,
        name,
        "persistent_volume_claims".to_string(),
        namespaces,
        state,
        Arc::new(K8sResources::<PersistentVolumeClaim>::watch),
    )
    .await
}

#[tauri::command]
pub async fn delete_persistent_volume_claims(
    name: String,
    namespace: Option<String>,
    resource_names: Vec<String>,
) -> Result<Vec<Result<String, String>>, String> {
    Ok(
        K8sResources::<PersistentVolumeClaim>::delete(name, namespace, resource_names).await?
    )
}