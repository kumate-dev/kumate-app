use std::sync::Arc;

use crate::{
    commands::common::watch,
    k8s::pod_disruption_budgets::{K8sPodDisruptionBudgets, PodDisruptionBudgetItem},
    utils::watcher::WatchManager,
};
use tauri::AppHandle;

#[tauri::command]
pub async fn list_pod_disruption_budgets(
    name: String,
    namespaces: Option<Vec<String>>,
) -> Result<Vec<PodDisruptionBudgetItem>, String> {
    K8sPodDisruptionBudgets::list(name, namespaces).await
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
        Arc::new(K8sPodDisruptionBudgets::watch),
    )
    .await
}
