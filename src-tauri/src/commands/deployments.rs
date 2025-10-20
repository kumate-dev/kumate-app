use crate::k8s::deployments::{DeploymentItem, K8sDeployments};
use anyhow::Result;

#[tauri::command]
pub async fn list_deployments(
    name: String,
    namespace: Option<String>,
) -> Result<Vec<DeploymentItem>, String> {
    K8sDeployments::list(name, namespace).await
}
