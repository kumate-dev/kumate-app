use anyhow::Result;
use crate::k8s::replicationcontrollers::{K8sReplicationControllers, ReplicationControllerItem};

#[tauri::command]
pub async fn list_replicationcontrollers(name: String, namespace: Option<String>) -> Result<Vec<ReplicationControllerItem>, String> {
    K8sReplicationControllers::list(name, namespace).await
}
