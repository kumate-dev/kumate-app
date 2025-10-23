use kube::{Api, Client, ResourceExt};
use serde::Serialize;
use tauri::AppHandle;

use super::client::K8sClient;
use crate::{k8s::common::K8sCommon, types::event::EventType};
use k8s_openapi::api::core::v1::ResourceQuota;

#[derive(Serialize, Debug, Clone)]
pub struct ResourceQuotaItem {
    pub name: String,
    pub namespace: String,
    pub hard: Vec<(String, String)>,
    pub used: Vec<(String, String)>,
    pub creation_timestamp: Option<String>,
}

impl From<ResourceQuota> for ResourceQuotaItem {
    fn from(rq: ResourceQuota) -> Self {
        (&rq).into()
    }
}

impl From<&ResourceQuota> for ResourceQuotaItem {
    fn from(rq: &ResourceQuota) -> Self {
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
            creation_timestamp: K8sCommon::to_creation_timestamp(rq.metadata.clone()),
        }
    }
}

pub struct K8sResourceQuotas;

impl K8sResourceQuotas {
    pub async fn list(
        context_name: String,
        namespaces: Option<Vec<String>>,
    ) -> Result<Vec<ResourceQuotaItem>, String> {
        K8sCommon::list_resources::<ResourceQuota, _, ResourceQuotaItem>(
            &context_name,
            namespaces,
            |client, ns| {
                Box::pin(async move {
                    let api: Api<ResourceQuota> = K8sClient::api::<ResourceQuota>(client, ns).await;
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
        let target_namespaces: Vec<Option<String>> = K8sCommon::get_target_namespaces(namespaces);

        for ns in target_namespaces {
            let api: Api<ResourceQuota> = K8sClient::api::<ResourceQuota>(client.clone(), ns).await;
            K8sCommon::event_spawn_watch(
                app_handle.clone(),
                event_name.clone(),
                K8sCommon::watch_stream(&api).await?,
                Self::emit_event,
            );
        }

        Ok(())
    }

    fn emit_event(app_handle: &AppHandle, event_name: &str, kind: EventType, rq: ResourceQuota) {
        K8sCommon::emit_event::<ResourceQuota, ResourceQuotaItem>(app_handle, event_name, kind, rq);
    }
}
