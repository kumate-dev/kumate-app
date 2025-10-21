use std::sync::Arc;

use crate::{
    k8s::namespaces::{K8sNamespaces, NamespaceItem},
    utils::watcher::WatchManager,
};
use anyhow::Result;
use tauri::AppHandle;

#[tauri::command]
pub async fn list_namespaces(name: String) -> Result<Vec<NamespaceItem>, String> {
    K8sNamespaces::list(name).await
}

#[tauri::command]
pub async fn watch_namespaces(
    app_handle: AppHandle,
    name: String,
    state: tauri::State<'_, WatchManager>,
) -> Result<String, String> {
    let event_name: Arc<String> = Arc::new(format!("k8s://{}/namespaces", name));
    let event_name_clone: Arc<String> = Arc::clone(&event_name);

    state
        .watch(app_handle, name.clone(), move |app_handle, name| {
            let event_name_inner = Arc::clone(&event_name_clone);
            async move {
                K8sNamespaces::watch(app_handle, name, event_name_inner.to_string()).await
            }
        })
        .await?;

    Ok(event_name.to_string())
}
