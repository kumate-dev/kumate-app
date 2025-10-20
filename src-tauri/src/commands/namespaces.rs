use anyhow::Result;
use crate::k8s::namespaces::{K8sNamespaces, NamespaceItem};


#[tauri::command]
pub async fn list_namespaces(name: String) -> Result<Vec<NamespaceItem>, String> {
  K8sNamespaces::list(name).await
}


#[tauri::command]
pub async fn watch_namespaces(app_handle: tauri::AppHandle, name: String) -> Result<String, String> {
    let event_name = format!("k8s://{}/namespaces", name);
    let handle = app_handle.clone();
    let event_name_clone = event_name.clone(); 

    tauri::async_runtime::spawn(async move {
        tokio::spawn(async move {
            if let Err(err) = K8sNamespaces::watch(handle, name.clone(), event_name_clone).await {
                eprintln!("watch_namespaces({}): {}", name, err);
            }
        });
    });

    Ok(event_name)
}
