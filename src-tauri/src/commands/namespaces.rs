use anyhow::Result;
use crate::k8s::namespaces::{K8sNamespaces, NamespaceItem};

#[tauri::command]
pub async fn list_namespaces(name: String) -> Result<Vec<NamespaceItem>, String> {
  K8sNamespaces::list(name).await
}
