use std::sync::Arc;

use crate::{
    commands::common::watch, services::k8s::resources::K8sResources, utils::watcher::WatchManager,
};
use k8s_openapi::api::policy::v1::PodDisruptionBudget;
use serde_json::Value;
use tauri::AppHandle;

#[tauri::command]
pub async fn list_pod_disruption_budgets(
    name: String,
    namespaces: Option<Vec<String>>,
) -> Result<Vec<Value>, String> {
    K8sResources::<PodDisruptionBudget>::list(name, namespaces).await
}

#[tauri::command]
pub async fn watch_pod_disruption_budgets(
    app_handle: AppHandle,
    name: String,
    namespaces: Option<Vec<String>>,
    state: tauri::State<'_, WatchManager>,
) -> Result<String, String> {
    watch(
        app_handle,
        name,
        "pod_disruption_budgets".to_string(),
        namespaces,
        state,
        Arc::new(K8sResources::<PodDisruptionBudget>::watch),
    )
    .await
}

#[tauri::command]
pub async fn delete_pod_disruption_budgets(
    name: String,
    namespace: Option<String>,
    resource_names: Vec<String>,
) -> Result<Vec<Result<String, String>>, String> {
    Ok(K8sResources::<PodDisruptionBudget>::delete(name, namespace, resource_names).await?)
}
