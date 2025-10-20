use k8s_openapi::api::apps::v1::{DaemonSet, DaemonSetStatus};
use k8s_openapi::apimachinery::pkg::apis::meta::v1::Time;
use kube::{Api, ResourceExt, Client};
use kube::api::{ListParams, ObjectList};
use serde::Serialize;

use super::client::K8sClient;

#[derive(Serialize, Debug, Clone)]
pub struct DaemonSetItem {
    pub name: String,
    pub namespace: String,
    pub ready: String,
    pub creation_timestamp: Option<String>,
}

pub struct K8sDaemonSets;

impl K8sDaemonSets {
    pub async fn list(name: String, namespace: Option<String>) -> Result<Vec<DaemonSetItem>, String> {
        let client: Client = K8sClient::for_context(&name).await?;
        let dss: Vec<DaemonSet> = Self::fetch(client, namespace).await?;
        let mut out: Vec<DaemonSetItem> = dss.into_iter().map(Self::to_item).collect();
        out.sort_by(|a: &DaemonSetItem, b: &DaemonSetItem| a.name.cmp(&b.name));
        Ok(out)
    }

    async fn fetch(client: Client, namespace: Option<String>) -> Result<Vec<DaemonSet>, String> {
        let api: Api<DaemonSet> = K8sClient::api::<DaemonSet>(client, namespace).await;
        let lp: ListParams = ListParams::default();
        let list: ObjectList<DaemonSet> = api.list(&lp).await.map_err(|e: kube::Error| e.to_string())?;
        Ok(list.items)
    }

    fn to_item(d: DaemonSet) -> DaemonSetItem {
        let desired: i32 = d.status.as_ref().map(|s: &DaemonSetStatus| s.desired_number_scheduled).unwrap_or(0);
        let ready: i32 = d.status.as_ref().map(|s: &DaemonSetStatus| s.number_ready).unwrap_or(0);
        DaemonSetItem {
            name: d.name_any(),
            namespace: d.namespace().unwrap_or_else(|| "default".to_string()),
            ready: format!("{}/{}", ready, desired),
            creation_timestamp: d.metadata.creation_timestamp.map(|t: Time| t.0.to_rfc3339()),
        }
    }
}