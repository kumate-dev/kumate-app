use kube::api::{ListParams, ObjectList};
use kube::{Api, Client, ResourceExt};
use serde::Serialize;
use tauri::AppHandle;

use super::client::K8sClient;
use crate::{k8s::common::K8sCommon, types::event::EventType};
use k8s_openapi::api::apps::v1::StatefulSet;

#[derive(Serialize, Debug, Clone)]
pub struct StatefulSetItem {
    pub name: String,
    pub namespace: String,
    pub ready: String,
    pub creation_timestamp: Option<String>,
}

impl From<StatefulSet> for StatefulSetItem {
    fn from(rc: StatefulSet) -> Self {
        (&rc).into()
    }
}

impl From<&StatefulSet> for StatefulSetItem {
    fn from(s: &StatefulSet) -> Self {
        let replicas: i32 = s.spec.as_ref().and_then(|sp| sp.replicas).unwrap_or(0);
        let ready: i32 = s
            .status
            .as_ref()
            .and_then(|st| st.ready_replicas)
            .unwrap_or(0);

        StatefulSetItem {
            name: s.name_any(),
            namespace: K8sCommon::to_namespace(s.namespace()),
            ready: K8sCommon::to_replicas_ready(replicas, ready),
            creation_timestamp: K8sCommon::to_creation_timestamp(s.metadata.clone()),
        }
    }
}

pub struct K8sStatefulSets;

impl K8sStatefulSets {
    pub async fn list(
        context_name: String,
        namespaces: Option<Vec<String>>,
    ) -> Result<Vec<StatefulSetItem>, String> {
        K8sCommon::list_resources::<StatefulSet, _, StatefulSetItem>(
            &context_name,
            namespaces,
            |client, ns| {
                Box::pin(async move {
                    let api: Api<StatefulSet> = K8sClient::api::<StatefulSet>(client, ns).await;
                    let list: ObjectList<StatefulSet> = api
                        .list(&ListParams::default())
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
        let target_namespaces: Vec<Option<String>> = K8sCommon::get_target_namespaces(namespaces);

        for ns in target_namespaces {
            let api: Api<StatefulSet> = K8sClient::api::<StatefulSet>(client.clone(), ns).await;
            K8sCommon::event_spawn_watch(
                app_handle.clone(),
                event_name.clone(),
                K8sCommon::watch_stream(&api).await?,
                Self::emit_event,
            );
        }

        Ok(())
    }

    fn emit_event(app_handle: &AppHandle, event_name: &str, kind: EventType, s: StatefulSet) {
        K8sCommon::emit_event::<StatefulSet, StatefulSetItem>(app_handle, event_name, kind, s);
    }
}
