use anyhow::Result;

use crate::k8s::daemonsets::{DaemonSetItem, K8sDaemonSets};

#[tauri::command]
pub async fn list_daemonsets(
    name: String,
    namespace: Option<String>,
) -> Result<Vec<DaemonSetItem>, String> {
    K8sDaemonSets::list(name, namespace).await
}
