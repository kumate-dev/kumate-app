use crate::k8s::nodes::{K8sNodes, NodeItem};
use anyhow::Result;

#[tauri::command]
pub async fn list_nodes(name: String) -> Result<Vec<NodeItem>, String> {
    K8sNodes::list(name).await
}
