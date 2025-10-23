use futures_util::future::join_all;
use k8s_openapi::api::core::v1::ResourceQuota;
use kube::api::ObjectList;
use kube::{Api, Client, ResourceExt};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::k8s::common::K8sCommon;
use crate::types::event::EventType;

use super::client::K8sClient;

#[derive(Serialize, Debug, Clone)]
pub struct ResourceQuotaItem {
    pub name: String,
    pub namespace: String,
    pub hard: Vec<(String, String)>,
    pub used: Vec<(String, String)>,
    pub creation_timestamp: Option<String>,
}

#[derive(Serialize, Clone)]
struct ResourceQuotaEvent {
    r#type: EventType,
    object: ResourceQuotaItem,
}

pub struct K8sResourceQuotas;

impl K8sResourceQuotas {
    pub async fn list(
        name: String,
        namespaces: Option<Vec<String>>,
    ) -> Result<Vec<ResourceQuotaItem>, String> {
        let client: Client = K8sClient::for_context(&name).await?;
        let target_namespaces: Vec<Option<String>> = K8sCommon::get_target_namespaces(namespaces);

        let all_rqs: Vec<ResourceQuotaItem> = join_all(
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

        Ok(all_rqs)
    }

    pub async fn watch(
        app_handle: AppHandle,
        name: String,
        namespaces: Option<Vec<String>>,
        event_name: String,
    ) -> Result<(), String> {
        let client: Client = K8sClient::for_context(&name).await?;
        let target_namespaces: Vec<Option<String>> = K8sCommon::get_target_namespaces(namespaces);

        for ns in target_namespaces {
            let api: Api<ResourceQuota> = K8sClient::api::<ResourceQuota>(client.clone(), ns).await;

            K8sCommon::event_spawn_watch(
                app_handle.clone(),
                event_name.clone(),
                K8sCommon::watch_stream(&api).await?,
                Self::emit,
            );
        }

        Ok(())
    }

    async fn fetch(
        client: Client,
        namespace: Option<String>,
    ) -> Result<Vec<ResourceQuota>, String> {
        let api: Api<ResourceQuota> = K8sClient::api::<ResourceQuota>(client, namespace).await;
        let list: ObjectList<ResourceQuota> = api
            .list(&Default::default())
            .await
            .map_err(|e| e.to_string())?;
        Ok(list.items)
    }

    fn to_item(rq: ResourceQuota) -> ResourceQuotaItem {
        let hard: Vec<(String, String)> = rq
            .spec
            .as_ref()
            .map(|s| s.hard.clone().unwrap_or_default())
            .unwrap_or_default()
            .into_iter()
            .map(|(k, v)| (k, v.0))
            .collect::<Vec<_>>();

        let used: Vec<(String, String)> = rq
            .status
            .as_ref()
            .map(|s| s.used.clone().unwrap_or_default())
            .unwrap_or_default()
            .into_iter()
            .map(|(k, v)| (k, v.0))
            .collect::<Vec<_>>();

        ResourceQuotaItem {
            name: rq.name_any(),
            namespace: K8sCommon::to_namespace(rq.namespace()),
            hard,
            used,
            creation_timestamp: K8sCommon::to_creation_timestamp(rq.metadata),
        }
    }

    fn emit(app_handle: &tauri::AppHandle, event_name: &str, kind: EventType, rq: ResourceQuota) {
        if rq.metadata.name.is_some() {
            let item: ResourceQuotaItem = Self::to_item(rq);
            let event: ResourceQuotaEvent = ResourceQuotaEvent {
                r#type: kind,
                object: item,
            };
            let _ = app_handle.emit(event_name, event);
        }
    }
}
