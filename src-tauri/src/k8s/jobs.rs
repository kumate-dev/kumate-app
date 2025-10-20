use k8s_openapi::api::batch::v1::{Job, JobSpec, JobStatus};
use k8s_openapi::apimachinery::pkg::apis::meta::v1::Time;
use kube::{Api, ResourceExt, Client};
use kube::api::{ListParams, ObjectList};
use serde::Serialize;

use super::client::K8sClient;

#[derive(Serialize, Debug, Clone)]
pub struct JobItem {
    pub name: String,
    pub namespace: String,
    pub progress: String,
    pub creation_timestamp: Option<String>,
}

pub struct K8sJobs;

impl K8sJobs {
    pub async fn list(name: String, namespace: Option<String>) -> Result<Vec<JobItem>, String> {
        let client: Client = K8sClient::for_context(&name).await?;
        let jobs: Vec<Job> = Self::fetch(client, namespace).await?;
        let mut out: Vec<JobItem> = jobs.into_iter().map(Self::to_item).collect();
        out.sort_by(|a: &JobItem, b: &JobItem| a.name.cmp(&b.name));
        Ok(out)
    }

    async fn fetch(client: Client, namespace: Option<String>) -> Result<Vec<Job>, String> {
        let api: Api<Job> = K8sClient::api::<Job>(client, namespace).await;
        let lp: ListParams = ListParams::default();
        let list: ObjectList<Job> = api.list(&lp).await.map_err(|e: kube::Error| e.to_string())?;
        Ok(list.items)
    }

    fn to_item(j: Job) -> JobItem {
        let completions: i32 = j.status.as_ref().and_then(|s: &JobStatus| s.succeeded).unwrap_or(0);
        let desired: i32 = j.spec.as_ref().and_then(|s: &JobSpec| s.completions).unwrap_or(0);
        JobItem {
            name: j.name_any(),
            namespace: j.namespace().unwrap_or_else(|| "default".to_string()),
            progress: format!("{}/{}", completions, desired),
            creation_timestamp: j.metadata.creation_timestamp.map(|t: Time| t.0.to_rfc3339()),
        }
    }
}