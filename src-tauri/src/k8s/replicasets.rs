use k8s_openapi::{
    api::apps::v1::{ReplicaSet, ReplicaSetSpec, ReplicaSetStatus},
    apimachinery::pkg::apis::meta::v1::Time,
};
use kube::{
    api::{ListParams, ObjectList},
    Api, Client, ResourceExt,
};
use serde::Serialize;

use super::client::K8sClient;

#[derive(Serialize, Debug, Clone)]
pub struct ReplicaSetItem {
    pub name: String,
    pub namespace: String,
    pub ready: String,
    pub creation_timestamp: Option<String>,
}

pub struct K8sReplicaSets;

impl K8sReplicaSets {
    pub async fn list(
        name: String,
        namespace: Option<String>,
    ) -> Result<Vec<ReplicaSetItem>, String> {
        let client: Client = K8sClient::for_context(&name).await?;
        let rss: Vec<ReplicaSet> = Self::fetch(client, namespace).await?;
        let mut out: Vec<ReplicaSetItem> = rss.into_iter().map(Self::to_item).collect();
        out.sort_by(|a: &ReplicaSetItem, b: &ReplicaSetItem| a.name.cmp(&b.name));
        Ok(out)
    }

    async fn fetch(client: Client, namespace: Option<String>) -> Result<Vec<ReplicaSet>, String> {
        let api: Api<ReplicaSet> = K8sClient::api::<ReplicaSet>(client, namespace).await;
        let lp: ListParams = ListParams::default();
        let list: ObjectList<ReplicaSet> = api
            .list(&lp)
            .await
            .map_err(|e: kube::Error| e.to_string())?;
        Ok(list.items)
    }

    fn to_item(r: ReplicaSet) -> ReplicaSetItem {
        let replicas: i32 = r
            .spec
            .as_ref()
            .and_then(|sp: &ReplicaSetSpec| sp.replicas)
            .unwrap_or(0);
        let ready: i32 = r
            .status
            .as_ref()
            .and_then(|st: &ReplicaSetStatus| st.ready_replicas)
            .unwrap_or(0);
        ReplicaSetItem {
            name: r.name_any(),
            namespace: r.namespace().unwrap_or_else(|| "default".to_string()),
            ready: format!("{}/{}", ready, replicas),
            creation_timestamp: r
                .metadata
                .creation_timestamp
                .map(|t: Time| t.0.to_rfc3339()),
        }
    }
}
