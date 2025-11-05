use std::sync::Arc;

use crate::{
    commands::common::watch, manager::k8s::resources::K8sResources, utils::watcher::WatchManager,
};
use k8s_openapi::api::rbac::v1::Role;
use serde_json::Value;
use tauri::AppHandle;

#[tauri::command]
pub async fn create_role(name: String, namespace: Option<String>, manifest: Value) -> Result<Value, String> {
    K8sResources::<Role>::create(name, namespace, manifest).await
}

#[tauri::command]
pub async fn update_role(name: String, namespace: Option<String>, manifest: Value) -> Result<Value, String> {
    K8sResources::<Role>::update(name, namespace, manifest).await
}

#[tauri::command]
pub async fn list_roles(name: String, namespaces: Option<Vec<String>>) -> Result<Vec<Value>, String> {
    K8sResources::<Role>::list(name, namespaces).await
}

#[tauri::command]
pub async fn watch_roles(
    app_handle: AppHandle,
    name: String,
    namespaces: Option<Vec<String>>,
    state: tauri::State<'_, WatchManager>,
) -> Result<String, String> {
    watch(
        app_handle,
        name,
        "roles".to_string(),
        namespaces,
        state,
        Arc::new(K8sResources::<Role>::watch),
    )
    .await
}

#[tauri::command]
pub async fn delete_roles(name: String, namespace: Option<String>, resource_names: Vec<String>) -> Result<Vec<Result<String, String>>, String> {
    Ok(K8sResources::<Role>::delete(name, namespace, resource_names).await?)
}