use std::sync::Arc;

use crate::{
    commands::common::watch, manager::k8s::cluster_resources::K8sClusterResources, utils::watcher::WatchManager,
};
use k8s_openapi::api::rbac::v1::ClusterRoleBinding;
use serde_json::Value;
use tauri::AppHandle;

#[tauri::command]
pub async fn create_cluster_role_binding(name: String, manifest: Value) -> Result<Value, String> {
    K8sClusterResources::<ClusterRoleBinding>::create(name, manifest).await
}

#[tauri::command]
pub async fn update_cluster_role_binding(name: String, manifest: Value) -> Result<Value, String> {
    K8sClusterResources::<ClusterRoleBinding>::update(name, manifest).await
}

#[tauri::command]
pub async fn list_cluster_role_bindings(name: String) -> Result<Vec<Value>, String> {
    K8sClusterResources::<ClusterRoleBinding>::list(name).await
}

#[tauri::command]
pub async fn watch_cluster_role_bindings(
    app_handle: AppHandle,
    name: String,
    state: tauri::State<'_, WatchManager>,
) -> Result<String, String> {
    watch(
        app_handle,
        name,
        "cluster_role_bindings".to_string(),
        None,
        state,
        Arc::new(|app_handle, name, _namespaces, event_name| {
            K8sClusterResources::<ClusterRoleBinding>::watch(app_handle, name, event_name)
        }),
    )
    .await
}

#[tauri::command]
pub async fn delete_cluster_role_bindings(name: String, resource_names: Vec<String>) -> Result<Vec<Result<String, String>>, String> {
    Ok(K8sClusterResources::<ClusterRoleBinding>::delete(name, resource_names).await?)
}