use kube::{Api, Client, ResourceExt};
use serde::Serialize;
use tauri::AppHandle;

use super::client::K8sClient;
use crate::k8s::common::K8sCommon;
use crate::types::event::EventType;
use k8s_openapi::api::apps::v1::{DaemonSet, DaemonSetStatus};

#[derive(Serialize, Debug, Clone)]
pub struct DaemonSetItem {
    pub name: String,
    pub namespace: String,
    pub ready: String,
    pub creation_timestamp: Option<String>,
}

impl From<DaemonSet> for DaemonSetItem {
    fn from(ds: DaemonSet) -> Self {
        (&ds).into()
    }
}

impl From<&DaemonSet> for DaemonSetItem {
    fn from(ds: &DaemonSet) -> Self {
        Self {
            name: ds.name_any(),
            namespace: K8sCommon::to_namespace(ds.namespace()),
            ready: K8sDaemonSets::extract_ready(ds),
            creation_timestamp: K8sCommon::to_creation_timestamp(ds.metadata.clone()),
        }
    }
}

pub struct K8sDaemonSets;

impl K8sDaemonSets {
    pub async fn list(
        name: String,
        namespaces: Option<Vec<String>>,
    ) -> Result<Vec<DaemonSetItem>, String> {
        K8sCommon::list_resources::<DaemonSet, _, DaemonSetItem>(&name, namespaces, |client, ns| {
            Box::pin(async move {
                let api: Api<DaemonSet> = K8sClient::api::<DaemonSet>(client, ns).await;
                let list = api
                    .list(&Default::default())
                    .await
                    .map_err(|e| e.to_string())?;
                Ok(list.items)
            })
        })
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
            let api: Api<DaemonSet> = K8sClient::api::<DaemonSet>(client.clone(), ns).await;
            K8sCommon::event_spawn_watch(
                app_handle.clone(),
                event_name.clone(),
                K8sCommon::watch_stream(&api).await?,
                Self::emit_event,
            );
        }

        Ok(())
    }

    fn emit_event(app_handle: &AppHandle, event_name: &str, kind: EventType, ds: DaemonSet) {
        K8sCommon::emit_event::<DaemonSet, DaemonSetItem>(app_handle, event_name, kind, ds);
    }

    fn extract_ready(ds: &DaemonSet) -> String {
        let desired: i32 = ds
            .status
            .as_ref()
            .map(|s: &DaemonSetStatus| s.desired_number_scheduled)
            .unwrap_or(0);
        let ready: i32 = ds
            .status
            .as_ref()
            .map(|s: &DaemonSetStatus| s.number_ready)
            .unwrap_or(0);
        K8sCommon::to_replicas_ready(desired, ready)
    }
}
