use anyhow::Result;
use crate::k8s::jobs::{JobItem, K8sJobs};


#[tauri::command]
pub async fn list_jobs(name: String, namespace: Option<String>) -> Result<Vec<JobItem>, String> {
    K8sJobs::list(name, namespace).await
}
