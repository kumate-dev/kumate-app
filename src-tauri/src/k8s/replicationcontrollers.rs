use k8s_openapi::api::core::v1::{ReplicationController, ReplicationControllerSpec, ReplicationControllerStatus};
use k8s_openapi::apimachinery::pkg::apis::meta::v1::Time;
use kube::{Api, ResourceExt, Client};
use kube::api::ListParams;
use serde::Serialize;

use super::client::K8sClient;

#[derive(Serialize, Debug, Clone)]
pub struct ReplicationControllerItem {
    pub name: String,
    pub namespace: String,
    pub ready: String,
    pub creation_timestamp: Option<String>,
}

pub struct K8sReplicationControllers;

impl K8sReplicationControllers {
    pub async fn list(name: String, namespace: Option<String>) -> Result<Vec<ReplicationControllerItem>, String> {
        let client: Client = K8sClient::for_context(&name).await?;
        let rcs: Vec<ReplicationController> = Self::fetch(client, namespace).await?;
        let mut out: Vec<ReplicationControllerItem> = rcs.into_iter().map(Self::rc_to_item).collect();
        out.sort_by(|a: &ReplicationControllerItem, b: &ReplicationControllerItem| a.name.cmp(&b.name));
        Ok(out)
    }

    async fn fetch(client: Client, namespace: Option<String>) -> Result<Vec<ReplicationController>, String> {
        let api: Api<ReplicationController> = K8sClient::api::<ReplicationController>(client, namespace).await;
        let lp: ListParams = ListParams::default();
        let list: kube::api::ObjectList<ReplicationController> = api.list(&lp).await.map_err(|e: kube::Error| e.to_string())?;
        Ok(list.items)
    }

    fn rc_to_item(r: ReplicationController) -> ReplicationControllerItem {
        let replicas: i32 = r.spec.as_ref().and_then(|sp: &ReplicationControllerSpec| sp.replicas).unwrap_or(0);
        let ready: i32 = r.status.as_ref().and_then(|st: &ReplicationControllerStatus| st.ready_replicas).unwrap_or(0);
        ReplicationControllerItem {
            name: r.name_any(),
            namespace: r.namespace().unwrap_or_else(|| "default".to_string()),
            ready: format!("{}/{}", ready, replicas),
            creation_timestamp: r.metadata.creation_timestamp.map(|t: Time| t.0.to_rfc3339()),
        }
    }
}