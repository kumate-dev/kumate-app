use std::pin::Pin;

use futures_util::{Stream, StreamExt};
use k8s_openapi::api::apps::v1::{DaemonSet, DaemonSetStatus};
use kube::api::{ListParams, ObjectList, WatchEvent, WatchParams};
use kube::{Api, Client, ResourceExt};
use serde::Serialize;
use tauri::Emitter;

use crate::types::event::EventType;
use crate::utils::k8s::{to_creation_timestamp, to_namespace, to_replicas_ready};

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
        namespace: Option<String>,
    ) -> Result<Vec<DaemonSetItem>, String> {
        let client: Client = K8sClient::for_context(&name).await?;
        let dss: Vec<DaemonSet> = Self::fetch(client, namespace).await?;
        let mut out: Vec<DaemonSetItem> = dss.into_iter().map(Self::to_item).collect();
        out.sort_by(|a: &DaemonSetItem, b: &DaemonSetItem| a.name.cmp(&b.name));
        Ok(out)
    }

    pub async fn watch(
        app_handle: tauri::AppHandle,
        name: String,
        namespace: Option<String>,
        event_name: String,
    ) -> Result<(), String> {
        let client: Client = K8sClient::for_context(&name).await?;
        let api: Api<DaemonSet> = K8sClient::api::<DaemonSet>(client, namespace).await;

        let mut stream: Pin<
            Box<dyn Stream<Item = Result<WatchEvent<DaemonSet>, kube::Error>> + Send>,
        > = api
            .watch(&WatchParams::default(), "0")
            .await
            .map_err(|e| e.to_string())?
            .boxed();

        while let Some(status) = stream.next().await {
            match status {
                Ok(WatchEvent::Added(cj)) => {
                    Self::emit(&app_handle, &event_name, EventType::ADDED, cj)
                }
                Ok(WatchEvent::Modified(cj)) => {
                    Self::emit(&app_handle, &event_name, EventType::MODIFIED, cj)
                }
                Ok(WatchEvent::Deleted(cj)) => {
                    Self::emit(&app_handle, &event_name, EventType::DELETED, cj)
                }
                Err(e) => eprintln!("DaemonSet watch error: {}", e),
                _ => {}
            }
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
            namespace: to_namespace(d.namespace()),
            ready: Self::extract_ready(&d),
            creation_timestamp: to_creation_timestamp(d.metadata),
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
        to_replicas_ready(desired, ready)
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
