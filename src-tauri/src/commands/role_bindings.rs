use std::sync::Arc;

use crate::{
    commands::common::watch, manager::k8s::resources::K8sResources, utils::watcher::WatchManager,
};
use k8s_openapi::api::rbac::v1::RoleBinding;
use serde_json::Value;
use tauri::AppHandle;

#[tauri::command]
pub async fn create_role_binding(name: String, namespace: Option<String>, manifest: Value) -> Result<Value, String> {
    K8sResources::<RoleBinding>::create(name, namespace, manifest).await
}

#[tauri::command]
pub async fn update_role_binding(name: String, namespace: Option<String>, manifest: Value) -> Result<Value, String> {
    K8sResources::<RoleBinding>::update(name, namespace, manifest).await
}

#[tauri::command]
pub async fn list_role_bindings(name: String, namespaces: Option<Vec<String>>) -> Result<Vec<Value>, String> {
    K8sResources::<RoleBinding>::list(name, namespaces).await
}

#[tauri::command]
pub async fn watch_role_bindings(
    app_handle: AppHandle,
    name: String,
    namespaces: Option<Vec<String>>,
    state: tauri::State<'_, WatchManager>,
) -> Result<String, String> {
    watch(
        app_handle,
        name,
        "role_bindings".to_string(),
        namespaces,
        state,
        Arc::new(K8sResources::<RoleBinding>::watch),
    )
    .await
}

#[tauri::command]
pub async fn delete_role_bindings(name: String, namespace: Option<String>, resource_names: Vec<String>) -> Result<Vec<Result<String, String>>, String> {
    Ok(K8sResources::<RoleBinding>::delete(name, namespace, resource_names).await?)
}