use anyhow::Result;
use crate::k8s::replicasets::{K8sReplicaSets, ReplicaSetItem};


#[tauri::command]
pub async fn list_replicasets(name: String, namespace: Option<String>) -> Result<Vec<ReplicaSetItem>, String> {
    K8sReplicaSets::list(name, namespace).await
}
