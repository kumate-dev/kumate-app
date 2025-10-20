use crate::k8s::cronjobs::{CronJobItem, K8sCronJobs};
use anyhow::Result;

#[tauri::command]
pub async fn list_cronjobs(
    name: String,
    namespace: Option<String>,
) -> Result<Vec<CronJobItem>, String> {
    K8sCronJobs::list(name, namespace).await
}
