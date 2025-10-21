use std::pin::Pin;

use futures_util::{Stream, StreamExt};
use k8s_openapi::api::apps::v1::{StatefulSet, StatefulSetSpec, StatefulSetStatus};
use kube::api::ObjectList;
use kube::{
    api::{ListParams, WatchEvent, WatchParams},
    Api, Client, ResourceExt,
};
use serde::Serialize;
use tauri::Emitter;

use crate::types::event::EventType;
use crate::utils::k8s::{to_creation_timestamp, to_namespace, to_replicas_ready};

use super::client::K8sClient;

#[derive(Serialize, Debug, Clone)]
pub struct StatefulSetItem {
    pub name: String,
    pub namespace: String,
    pub ready: String,
    pub creation_timestamp: Option<String>,
}

#[derive(Serialize, Clone)]
struct StatefulSetEvent {
    r#type: EventType,
    object: StatefulSetItem,
}

pub struct K8sStatefulSets;

impl K8sStatefulSets {
    pub async fn list(
        name: String,
        namespace: Option<String>,
    ) -> Result<Vec<StatefulSetItem>, String> {
        let client: Client = K8sClient::for_context(&name).await?;
        let ssets: Vec<StatefulSet> = Self::fetch(client, namespace).await?;
        let mut out: Vec<StatefulSetItem> = ssets.into_iter().map(Self::to_item).collect();
        out.sort_by(|a, b| a.name.cmp(&b.name));
        Ok(out)
    }

    pub async fn watch(
        app_handle: tauri::AppHandle,
        name: String,
        namespace: Option<String>,
        event_name: String,
    ) -> Result<(), String> {
        let client: Client = K8sClient::for_context(&name).await?;
        let api: Api<StatefulSet> = K8sClient::api::<StatefulSet>(client, namespace).await;

        let mut stream: Pin<
            Box<dyn Stream<Item = Result<WatchEvent<StatefulSet>, kube::Error>> + Send>,
        > = api
            .watch(&WatchParams::default(), "0")
            .await
            .map_err(|e| e.to_string())?
            .boxed();

        while let Some(status) = stream.next().await {
            match status {
                Ok(WatchEvent::Added(dep)) => {
                    Self::emit(&app_handle, &event_name, EventType::ADDED, dep)
                }
                Ok(WatchEvent::Modified(dep)) => {
                    Self::emit(&app_handle, &event_name, EventType::MODIFIED, dep)
                }
                Ok(WatchEvent::Deleted(dep)) => {
                    Self::emit(&app_handle, &event_name, EventType::DELETED, dep)
                }
                Err(e) => eprintln!("StatefulSet watch error: {}", e),
                _ => {}
            }
        }
        Ok(())
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

    fn to_item(s: StatefulSet) -> StatefulSetItem {
        StatefulSetItem {
            name: s.name_any(),
            namespace: to_namespace(s.namespace()),
            ready: Self::extract_ready(&s),
            creation_timestamp: to_creation_timestamp(s.metadata),
        }
    }

    fn extract_ready(d: &StatefulSet) -> String {
        let replicas: i32 = d
            .spec
            .as_ref()
            .and_then(|s: &StatefulSetSpec| s.replicas)
            .unwrap_or(0);
        let ready: i32 = d
            .status
            .as_ref()
            .and_then(|s: &StatefulSetStatus| s.ready_replicas)
            .unwrap_or(0);
        to_replicas_ready(replicas, ready)
    }

    fn emit(app_handle: &tauri::AppHandle, event_name: &str, kind: EventType, r: StatefulSet) {
        if r.metadata.name.is_some() {
            let item: StatefulSetItem = Self::to_item(r);
            let event: StatefulSetEvent = StatefulSetEvent {
                r#type: kind,
                object: item,
            };
            let _ = app_handle.emit(event_name, event);
        }
    }
}
