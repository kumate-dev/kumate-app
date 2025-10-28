use std::sync::Arc;

use crate::{services::k8s::resource_quotas::K8sResourceQuotas, utils::watcher::WatchManager};
use anyhow::Result;
use tauri::AppHandle;

use crate::commands::common::watch;

#[tauri::command]
pub async fn list_resource_quotas(
    name: String,
    namespaces: Option<Vec<String>>,
) -> Result<Vec<crate::services::k8s::resource_quotas::ResourceQuotaItem>, String> {
    K8sResourceQuotas::list(name, namespaces).await
}

#[tauri::command]
pub async fn watch_resource_quotas(
    app_handle: AppHandle,
    name: String,
    namespaces: Option<Vec<String>>,
    state: tauri::State<'_, WatchManager>,
) -> Result<String, String> {
    watch(
        app_handle,
        name,
        "resource_quotas".to_string(),
        namespaces,
        state,
        Arc::new(K8sResourceQuotas::watch),
    )
    .await
}
