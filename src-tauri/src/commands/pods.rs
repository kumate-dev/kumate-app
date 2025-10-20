use crate::k8s::pods::{K8sPods, PodItem};
use anyhow::Result;

#[tauri::command]
pub async fn list_pods(name: String, namespace: Option<String>) -> Result<Vec<PodItem>, String> {
    K8sPods::list(name, namespace).await
}
