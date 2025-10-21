use std::pin::Pin;

use futures_util::{Stream, StreamExt};

use k8s_openapi::api::core::v1::{
    ReplicationController, ReplicationControllerSpec, ReplicationControllerStatus,
};
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
pub struct ReplicationControllerItem {
    pub name: String,
    pub namespace: String,
    pub ready: String,
    pub creation_timestamp: Option<String>,
}

#[derive(Serialize, Clone)]
struct ReplicationControllerEvent {
    r#type: EventType,
    object: ReplicationControllerItem,
}

pub struct K8sReplicationControllers;

impl K8sReplicationControllers {
    pub async fn list(
        name: String,
        namespace: Option<String>,
    ) -> Result<Vec<ReplicationControllerItem>, String> {
        let client: Client = K8sClient::for_context(&name).await?;
        let rcs: Vec<ReplicationController> = Self::fetch(client, namespace).await?;
        let mut out: Vec<ReplicationControllerItem> = rcs.into_iter().map(Self::to_item).collect();
        out.sort_by(
            |a: &ReplicationControllerItem, b: &ReplicationControllerItem| a.name.cmp(&b.name),
        );
        Ok(out)
    }

    pub async fn watch(
        app_handle: tauri::AppHandle,
        name: String,
        namespace: Option<String>,
        event_name: String,
    ) -> Result<(), String> {
        let client: Client = K8sClient::for_context(&name).await?;
        let api: Api<ReplicationController> =
            K8sClient::api::<ReplicationController>(client, namespace).await;

        let mut stream: Pin<
            Box<dyn Stream<Item = Result<WatchEvent<ReplicationController>, kube::Error>> + Send>,
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
                Err(e) => eprintln!("ReplicaSet watch error: {}", e),
                _ => {}
            }
        }
        Ok(())
    }

    async fn fetch(
        client: Client,
        namespace: Option<String>,
    ) -> Result<Vec<ReplicationController>, String> {
        let api: Api<ReplicationController> =
            K8sClient::api::<ReplicationController>(client, namespace).await;
        let lp: ListParams = ListParams::default();
        let list: kube::api::ObjectList<ReplicationController> = api
            .list(&lp)
            .await
            .map_err(|e: kube::Error| e.to_string())?;
        Ok(list.items)
    }

    fn to_item(r: ReplicationController) -> ReplicationControllerItem {
        ReplicationControllerItem {
            name: r.name_any(),
            namespace: to_namespace(r.namespace()),
            ready: Self::extract_ready(&r),
            creation_timestamp: to_creation_timestamp(r.metadata),
        }
    }

    fn extract_ready(d: &ReplicationController) -> String {
        let replicas: i32 = d
            .spec
            .as_ref()
            .and_then(|s: &ReplicationControllerSpec| s.replicas)
            .unwrap_or(0);
        let ready: i32 = d
            .status
            .as_ref()
            .and_then(|s: &ReplicationControllerStatus| s.ready_replicas)
            .unwrap_or(0);
        to_replicas_ready(replicas, ready)
    }

    fn emit(
        app_handle: &tauri::AppHandle,
        event_name: &str,
        kind: EventType,
        r: ReplicationController,
    ) {
        if r.metadata.name.is_some() {
            let item: ReplicationControllerItem = Self::to_item(r);
            let event: ReplicationControllerEvent = ReplicationControllerEvent {
                r#type: kind,
                object: item,
            };
            let _ = app_handle.emit(event_name, event);
        }
    }
}
