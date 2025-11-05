use std::sync::Arc;

use crate::{
    commands::common::watch, manager::k8s::resources::K8sResources, utils::watcher::WatchManager,
};
use k8s_openapi::api::networking::v1::Ingress;
use serde_json::Value;
use tauri::AppHandle;

#[tauri::command]
pub async fn create_ingress(
    name: String,
    namespace: Option<String>,
    manifest: Value,
) -> Result<Value, String> {
    K8sResources::<Ingress>::create(name, namespace, manifest).await
}

#[tauri::command]
pub async fn update_ingress(
    name: String,
    namespace: Option<String>,
    manifest: Value,
) -> Result<Value, String> {
    K8sResources::<Ingress>::update(name, namespace, manifest).await
}

#[tauri::command]
pub async fn list_ingresses(
    name: String,
    namespaces: Option<Vec<String>>,
) -> Result<Vec<Value>, String> {
    K8sResources::<Ingress>::list(name, namespaces).await
}

#[tauri::command]
pub async fn watch_ingresses(
    app_handle: AppHandle,
    name: String,
    namespaces: Option<Vec<String>>,
    state: tauri::State<'_, WatchManager>,
) -> Result<String, String> {
    watch(
        app_handle,
        name,
        "ingresses".to_string(),
        namespaces,
        state,
        Arc::new(K8sResources::<Ingress>::watch),
    )
    .await
}

#[tauri::command]
pub async fn delete_ingresses(
    name: String,
    namespace: Option<String>,
    resource_names: Vec<String>,
) -> Result<Vec<Result<String, String>>, String> {
    Ok(K8sResources::<Ingress>::delete(name, namespace, resource_names).await?)
}
