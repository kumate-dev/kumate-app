use k8s_openapi::api::apps::v1::{StatefulSet, StatefulSetSpec, StatefulSetStatus};
use k8s_openapi::apimachinery::pkg::apis::meta::v1::Time;
use kube::api::{ListParams, ObjectList};
use kube::{Api, Client, ResourceExt};
use serde::Serialize;

use super::client::K8sClient;

#[derive(Serialize, Debug, Clone)]
pub struct StatefulSetItem {
    pub name: String,
    pub namespace: String,
    pub ready: String,
    pub creation_timestamp: Option<String>,
}

pub struct K8sStatefulSets;

impl K8sStatefulSets {
    pub async fn list(
        name: String,
        namespace: Option<String>,
    ) -> Result<Vec<StatefulSetItem>, String> {
        let client: Client = K8sClient::for_context(&name).await?;
        let ssets: Vec<StatefulSet> = Self::fetch(client, namespace).await?;
        let mut out: Vec<StatefulSetItem> = ssets.into_iter().map(Self::sset_to_item).collect();
        out.sort_by(|a, b| a.name.cmp(&b.name));
        Ok(out)
    }

    async fn fetch(client: Client, namespace: Option<String>) -> Result<Vec<StatefulSet>, String> {
        let api: Api<StatefulSet> = K8sClient::api::<StatefulSet>(client, namespace).await;
        let lp: ListParams = ListParams::default();
        let list: ObjectList<StatefulSet> = api
            .list(&lp)
            .await
            .map_err(|e: kube::Error| e.to_string())?;
        Ok(list.items)
    }

    fn sset_to_item(s: StatefulSet) -> StatefulSetItem {
        let replicas: i32 = s
            .spec
            .as_ref()
            .and_then(|sp: &StatefulSetSpec| sp.replicas)
            .unwrap_or(0);
        let ready: i32 = s
            .status
            .as_ref()
            .and_then(|st: &StatefulSetStatus| st.ready_replicas)
            .unwrap_or(0);
        StatefulSetItem {
            name: s.name_any(),
            namespace: s.namespace().unwrap_or_else(|| "default".to_string()),
            ready: format!("{}/{}", ready, replicas),
            creation_timestamp: s
                .metadata
                .creation_timestamp
                .map(|t: Time| t.0.to_rfc3339()),
        }
    }
}
