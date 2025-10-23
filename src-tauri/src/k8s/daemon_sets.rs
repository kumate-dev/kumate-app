use futures_util::future::join_all;
use k8s_openapi::api::apps::v1::{DaemonSet, DaemonSetStatus};
use kube::api::{ListParams, ObjectList};
use kube::{Api, Client, ResourceExt};
use serde::Serialize;
use tauri::Emitter;

use crate::k8s::common::K8sCommon;
use crate::types::event::EventType;

use super::client::K8sClient;

#[derive(Serialize, Debug, Clone)]
pub struct DaemonSetItem {
    pub name: String,
    pub namespace: String,
    pub ready: String,
    pub creation_timestamp: Option<String>,
}

#[derive(Serialize, Clone)]
struct DaemonSetEvent {
    r#type: EventType,
    object: DaemonSetItem,
}

pub struct K8sDaemonSets;

impl K8sDaemonSets {
    pub async fn list(
        name: String,
        namespaces: Option<Vec<String>>,
    ) -> Result<Vec<DaemonSetItem>, String> {
        let client: Client = K8sClient::for_context(&name).await?;
        let target_namespaces: Vec<Option<String>> = K8sCommon::get_target_namespaces(namespaces);

        let all_daemonsets: Vec<DaemonSetItem> = join_all(
            target_namespaces
                .into_iter()
                .map(|ns| Self::fetch(client.clone(), ns)),
        )
        .await
        .into_iter()
        .collect::<Result<Vec<_>, _>>()?
        .into_iter()
        .flatten()
        .map(Self::to_item)
        .collect();

        Ok(all_daemonsets)
    }

    pub async fn watch(
        app_handle: tauri::AppHandle,
        name: String,
        namespaces: Option<Vec<String>>,
        event_name: String,
    ) -> Result<(), String> {
        let client: Client = K8sClient::for_context(&name).await?;
        let target_namespaces: Vec<Option<String>> = K8sCommon::get_target_namespaces(namespaces);

        for ns in target_namespaces {
            let api: Api<DaemonSet> = K8sClient::api::<DaemonSet>(client.clone(), ns).await;

            K8sCommon::event_spawn_watch(
                app_handle.clone(),
                event_name.clone(),
                K8sCommon::watch_stream(&api).await?,
                Self::emit,
            );
        }

        Ok(())
    }

    async fn fetch(client: Client, namespace: Option<String>) -> Result<Vec<DaemonSet>, String> {
        let api: Api<DaemonSet> = K8sClient::api::<DaemonSet>(client, namespace).await;
        let lp: ListParams = ListParams::default();
        let list: ObjectList<DaemonSet> = api
            .list(&lp)
            .await
            .map_err(|e: kube::Error| e.to_string())?;
        Ok(list.items)
    }

    fn to_item(d: DaemonSet) -> DaemonSetItem {
        DaemonSetItem {
            name: d.name_any(),
            namespace: K8sCommon::to_namespace(d.namespace()),
            ready: Self::extract_ready(&d),
            creation_timestamp: K8sCommon::to_creation_timestamp(d.metadata),
        }
    }

    fn extract_ready(d: &DaemonSet) -> String {
        let desired: i32 = d
            .status
            .as_ref()
            .map(|s: &DaemonSetStatus| s.desired_number_scheduled)
            .unwrap_or(0);
        let ready: i32 = d
            .status
            .as_ref()
            .map(|s: &DaemonSetStatus| s.number_ready)
            .unwrap_or(0);
        K8sCommon::to_replicas_ready(desired, ready)
    }

    fn emit(app_handle: &tauri::AppHandle, event_name: &str, kind: EventType, ds: DaemonSet) {
        if ds.metadata.name.is_some() {
            let item: DaemonSetItem = Self::to_item(ds);
            let event: DaemonSetEvent = DaemonSetEvent {
                r#type: kind,
                object: item,
            };
            let _ = app_handle.emit(event_name, event);
        }
    }
}
