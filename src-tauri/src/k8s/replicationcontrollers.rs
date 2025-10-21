use futures_util::future::join_all;

use k8s_openapi::api::core::v1::{
    ReplicationController, ReplicationControllerSpec, ReplicationControllerStatus,
};
use kube::{
    api::{ListParams, ObjectList},
    Api, Client, ResourceExt,
};
use serde::Serialize;
use tauri::Emitter;

use crate::utils::k8s::{to_creation_timestamp, to_namespace, to_replicas_ready};
use crate::{
    types::event::EventType,
    utils::k8s::{event_spawn_watch, get_target_namespaces, watch_stream},
};

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
        namespaces: Option<Vec<String>>,
    ) -> Result<Vec<ReplicationControllerItem>, String> {
        let client: Client = K8sClient::for_context(&name).await?;
        let target_namespaces: Vec<String> = get_target_namespaces(namespaces);

        let all_replicationcontrollers: Vec<ReplicationControllerItem> =
            if target_namespaces.is_empty() {
                Self::fetch(client.clone(), None)
                    .await?
                    .into_iter()
                    .map(Self::to_item)
                    .collect()
            } else {
                let results: Vec<Vec<ReplicationController>> = join_all(
                    target_namespaces
                        .into_iter()
                        .map(|ns| Self::fetch(client.clone(), Some(ns))),
                )
                .await
                .into_iter()
                .collect::<Result<Vec<_>, _>>()?;
                results.into_iter().flatten().map(Self::to_item).collect()
            };

        Ok(all_replicationcontrollers)
    }

    pub async fn watch(
        app_handle: tauri::AppHandle,
        name: String,
        namespaces: Option<Vec<String>>,
        event_name: String,
    ) -> Result<(), String> {
        let client: Client = K8sClient::for_context(&name).await?;
        let target_namespaces: Vec<String> = namespaces.unwrap_or_else(|| vec![String::from("")]);

        for ns in target_namespaces {
            let api: Api<ReplicationController> = K8sClient::api::<ReplicationController>(
                client.clone(),
                if ns.is_empty() {
                    None
                } else {
                    Some(ns.clone())
                },
            )
            .await;

            event_spawn_watch(
                app_handle.clone(),
                event_name.clone(),
                watch_stream(&api).await?,
                Self::emit,
            );
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
        let list: ObjectList<ReplicationController> = api
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
