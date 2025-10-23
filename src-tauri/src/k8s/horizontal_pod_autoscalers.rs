use futures_util::future::join_all;
use k8s_openapi::api::autoscaling::v2::{
    HorizontalPodAutoscaler, HorizontalPodAutoscalerSpec, HorizontalPodAutoscalerStatus,
};
use kube::api::{ListParams, ObjectList};
use kube::{Api, Client, ResourceExt};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::types::event::EventType;
use crate::k8s::common::K8sCommon;

use super::client::K8sClient;

#[derive(Serialize, Debug, Clone)]
pub struct HorizontalPodAutoscalerItem {
    pub name: String,
    pub namespace: String,
    pub min_replicas: Option<i32>,
    pub max_replicas: i32,
    pub current_replicas: Option<i32>,
    pub desired_replicas: Option<i32>,
    pub target_ref: String,
    pub status: String,
    pub creation_timestamp: Option<String>,
}

#[derive(Serialize, Clone)]
struct HorizontalPodAutoscalerEvent {
    r#type: EventType,
    object: HorizontalPodAutoscalerItem,
}

pub struct K8sHorizontalPodAutoscalers;

impl K8sHorizontalPodAutoscalers {
    pub async fn list(
        name: String,
        namespaces: Option<Vec<String>>,
    ) -> Result<Vec<HorizontalPodAutoscalerItem>, String> {
        let client = K8sClient::for_context(&name).await?;
        let target_namespaces = K8sCommon::get_target_namespaces(namespaces);

        let all_hpas: Vec<HorizontalPodAutoscalerItem> = join_all(
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

        Ok(all_hpas)
    }

    pub async fn watch(
        app_handle: AppHandle,
        name: String,
        namespaces: Option<Vec<String>>,
        event_name: String,
    ) -> Result<(), String> {
        let client = K8sClient::for_context(&name).await?;
        let target_namespaces = K8sCommon::get_target_namespaces(namespaces);

        for ns in target_namespaces {
            let api: Api<HorizontalPodAutoscaler> =
                K8sClient::api::<HorizontalPodAutoscaler>(client.clone(), ns).await;
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
    ) -> Result<Vec<HorizontalPodAutoscaler>, String> {
        let api: Api<HorizontalPodAutoscaler> =
            K8sClient::api::<HorizontalPodAutoscaler>(client, namespace).await;
        let lp: ListParams = ListParams::default();
        let list: ObjectList<HorizontalPodAutoscaler> =
            api.list(&lp).await.map_err(|e| e.to_string())?;
        Ok(list.items)
    }

    fn to_item(hpa: HorizontalPodAutoscaler) -> HorizontalPodAutoscalerItem {
        let spec: Option<&HorizontalPodAutoscalerSpec> = hpa.spec.as_ref();
        let status: Option<&HorizontalPodAutoscalerStatus> = hpa.status.as_ref();

        HorizontalPodAutoscalerItem {
            name: hpa.name_any(),
            namespace: K8sCommon::to_namespace(hpa.namespace()),
            min_replicas: spec.and_then(|s| s.min_replicas),
            max_replicas: spec.map(|s| s.max_replicas).unwrap_or_default(),
            current_replicas: status.map(|st| st.current_replicas.unwrap_or_default()),
            desired_replicas: status.map(|st| st.desired_replicas),
            target_ref: spec
                .and_then(|s| Some(s.scale_target_ref.name.clone()))
                .unwrap_or_default(),
            status: Self::extract_status(status),
            creation_timestamp: K8sCommon::to_creation_timestamp(hpa.metadata),
        }
    }

    fn extract_status(status: Option<&HorizontalPodAutoscalerStatus>) -> String {
        status
            .and_then(|st| {
                st.conditions.as_ref()?.iter().find_map(|c| {
                    match (c.type_.as_str(), c.status.as_str()) {
                        ("ScalingActive", "True") => Some("Active".to_string()),
                        ("ScalingActive", "False") => Some("Error".to_string()),
                        ("AbleToScale", "True") => Some("AbleToScale".to_string()),
                        ("AbleToScale", "False") => Some("Failed".to_string()),
                        _ => None,
                    }
                })
            })
            .unwrap_or_else(|| "Unknown".to_string())
    }

    fn emit(
        app_handle: &AppHandle,
        event_name: &str,
        kind: EventType,
        hpa: HorizontalPodAutoscaler,
    ) {
        if hpa.metadata.name.is_some() {
            let item: HorizontalPodAutoscalerItem = Self::to_item(hpa);
            let event: HorizontalPodAutoscalerEvent = HorizontalPodAutoscalerEvent {
                r#type: kind,
                object: item,
            };
            let _ = app_handle.emit(event_name, event);
        }
    }
}
