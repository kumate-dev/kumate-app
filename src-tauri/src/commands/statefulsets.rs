use anyhow::Result;
use crate::k8s::statefulsets::{K8sStatefulSets, StatefulSetItem};

#[tauri::command]
pub async fn list_statefulsets(name: String, namespace: Option<String>) -> Result<Vec<StatefulSetItem>, String> {
    K8sStatefulSets::list(name, namespace).await
}
