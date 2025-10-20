use k8s_openapi::api::batch::v1::{CronJob, CronJobSpec, CronJobStatus};
use k8s_openapi::apimachinery::pkg::apis::meta::v1::Time;
use kube::api::{ListParams, ObjectList};
use kube::{Api, Client, ResourceExt};
use serde::Serialize;

use super::client::K8sClient;

#[derive(Serialize, Debug, Clone)]
pub struct CronJobItem {
    pub name: String,
    pub namespace: String,
    pub schedule: String,
    pub suspend: bool,
    pub last_schedule: Option<String>,
    pub creation_timestamp: Option<String>,
}

pub struct K8sCronJobs;

impl K8sCronJobs {
    pub async fn list(name: String, namespace: Option<String>) -> Result<Vec<CronJobItem>, String> {
        let client: Client = K8sClient::for_context(&name).await?;
        let cronjobs: Vec<CronJob> = Self::fetch(client, namespace).await?;
        let mut out: Vec<CronJobItem> = cronjobs.into_iter().map(Self::to_item).collect();
        out.sort_by(|a: &CronJobItem, b: &CronJobItem| a.name.cmp(&b.name));
        Ok(out)
    }

    async fn fetch(client: Client, namespace: Option<String>) -> Result<Vec<CronJob>, String> {
        let api: Api<CronJob> = K8sClient::api::<CronJob>(client, namespace).await;
        let lp: ListParams = ListParams::default();
        let list: ObjectList<CronJob> = api.list(&lp).await.map_err(|e| e.to_string())?;
        Ok(list.items)
    }

    fn to_item(cj: CronJob) -> CronJobItem {
        let schedule: String = cj
            .spec
            .as_ref()
            .map(|s: &CronJobSpec| s.schedule.clone())
            .unwrap_or_default();
        let suspend: bool = cj
            .spec
            .as_ref()
            .and_then(|s: &CronJobSpec| s.suspend)
            .unwrap_or(false);
        let last: Option<String> = cj
            .status
            .as_ref()
            .and_then(|st: &CronJobStatus| st.last_schedule_time.as_ref())
            .map(|t: &Time| t.0.to_rfc3339());
        CronJobItem {
            name: cj.name_any(),
            namespace: cj.namespace().unwrap_or_else(|| "default".to_string()),
            schedule,
            suspend,
            last_schedule: last,
            creation_timestamp: cj.metadata.creation_timestamp.map(|t| t.0.to_rfc3339()),
        }
    }
}
