use std::sync::Arc;

use crate::{
    commands::common::{restart_patch, scale_patch, watch},
    manager::k8s::resources::K8sResources,
    utils::watcher::WatchManager,
};
use k8s_openapi::api::apps::v1::StatefulSet;
use serde_json::Value;
use tauri::AppHandle;

#[tauri::command]
pub async fn create_stateful_set(
    name: String,
    namespace: Option<String>,
    manifest: Value,
) -> Result<Value, String> {
    K8sResources::<StatefulSet>::create(name, namespace, manifest).await
}

#[tauri::command]
pub async fn update_stateful_set(
    name: String,
    namespace: Option<String>,
    manifest: Value,
) -> Result<Value, String> {
    K8sResources::<StatefulSet>::update(name, namespace, manifest).await
}

#[tauri::command]
pub async fn list_stateful_sets(
    name: String,
    namespaces: Option<Vec<String>>,
) -> Result<Vec<Value>, String> {
    K8sResources::<StatefulSet>::list(name, namespaces).await
}

#[tauri::command]
pub async fn watch_stateful_sets(
    app_handle: AppHandle,
    name: String,
    namespaces: Option<Vec<String>>,
    state: tauri::State<'_, WatchManager>,
) -> Result<String, String> {
    watch(
        app_handle,
        name,
        "stateful_sets".to_string(),
        namespaces,
        state,
        Arc::new(K8sResources::<StatefulSet>::watch),
    )
    .await
}

#[tauri::command]
pub async fn delete_stateful_sets(
    name: String,
    namespace: Option<String>,
    resource_names: Vec<String>,
) -> Result<Vec<Result<String, String>>, String> {
    Ok(K8sResources::<StatefulSet>::delete(name, namespace, resource_names).await?)
}

#[tauri::command]
pub async fn restart_stateful_set(
    name: String,
    namespace: Option<String>,
    resource_name: String,
) -> Result<Value, String> {
    K8sResources::<StatefulSet>::patch(
        name,
        namespace,
        resource_name,
        restart_patch(),
        "merge".into(),
    )
    .await
}

#[tauri::command]
pub async fn scale_stateful_set(
    name: String,
    namespace: Option<String>,
    resource_name: String,
    replicas: i32,
) -> Result<Value, String> {
    K8sResources::<StatefulSet>::patch(
        name,
        namespace,
        resource_name,
        scale_patch(replicas),
        "merge".into(),
    )
    .await
}
