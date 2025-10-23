use kube::{Api, Client, ResourceExt};
use serde::Serialize;
use tauri::AppHandle;

use super::client::K8sClient;
use crate::{k8s::common::K8sCommon, types::event::EventType};
use k8s_openapi::api::apps::v1::{ReplicaSet, ReplicaSetSpec, ReplicaSetStatus};

#[derive(Serialize, Debug, Clone)]
pub struct ReplicaSetItem {
    pub name: String,
    pub namespace: String,
    pub ready: String,
    pub creation_timestamp: Option<String>,
}

impl From<ReplicaSet> for ReplicaSetItem {
    fn from(rs: ReplicaSet) -> Self {
        (&rs).into()
    }
}

impl From<&ReplicaSet> for ReplicaSetItem {
    fn from(rs: &ReplicaSet) -> Self {
        Self {
            name: rs.name_any(),
            namespace: K8sCommon::to_namespace(rs.namespace()),
            ready: K8sReplicaSets::extract_ready(rs),
            creation_timestamp: K8sCommon::to_creation_timestamp(rs.metadata.clone()),
        }
    }
}

pub struct K8sReplicaSets;

impl K8sReplicaSets {
    pub async fn list(
        context_name: String,
        namespaces: Option<Vec<String>>,
    ) -> Result<Vec<ReplicaSetItem>, String> {
        K8sCommon::list_resources::<ReplicaSet, _, ReplicaSetItem>(
            &context_name,
            namespaces,
            |client, ns| {
                Box::pin(async move {
                    let api: Api<ReplicaSet> = K8sClient::api::<ReplicaSet>(client, ns).await;
                    let list = api
                        .list(&Default::default())
                        .await
                        .map_err(|e| e.to_string())?;
                    Ok(list.items)
                })
            },
        )
        .await
    }

    pub async fn watch(
        app_handle: AppHandle,
        context_name: String,
        namespaces: Option<Vec<String>>,
        event_name: String,
    ) -> Result<(), String> {
        let client: Client = K8sClient::for_context(&context_name).await?;
        let target_namespaces = K8sCommon::get_target_namespaces(namespaces);

        for ns in target_namespaces {
            let api: Api<ReplicaSet> = K8sClient::api::<ReplicaSet>(client.clone(), ns).await;
            K8sCommon::event_spawn_watch(
                app_handle.clone(),
                event_name.clone(),
                K8sCommon::watch_stream(&api).await?,
                Self::emit_event,
            );
        }

        Ok(())
    }

    fn emit_event(app_handle: &AppHandle, event_name: &str, kind: EventType, rs: ReplicaSet) {
        K8sCommon::emit_event::<ReplicaSet, ReplicaSetItem>(app_handle, event_name, kind, rs);
    }

    fn extract_ready(rs: &ReplicaSet) -> String {
        let replicas: i32 = rs
            .spec
            .as_ref()
            .and_then(|s: &ReplicaSetSpec| s.replicas)
            .unwrap_or(0);
        let ready: i32 = rs
            .status
            .as_ref()
            .and_then(|s: &ReplicaSetStatus| s.ready_replicas)
            .unwrap_or(0);
        K8sCommon::to_replicas_ready(replicas, ready)
    }
}
