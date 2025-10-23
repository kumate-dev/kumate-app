use kube::{Api, Client, ResourceExt};
use serde::Serialize;
use tauri::AppHandle;

use super::client::K8sClient;
use crate::k8s::common::K8sCommon;
use crate::types::event::EventType;
use k8s_openapi::api::autoscaling::v2::{HorizontalPodAutoscaler, HorizontalPodAutoscalerStatus};

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

impl From<HorizontalPodAutoscaler> for HorizontalPodAutoscalerItem {
    fn from(hpa: HorizontalPodAutoscaler) -> Self {
        (&hpa).into()
    }
}

impl From<&HorizontalPodAutoscaler> for HorizontalPodAutoscalerItem {
    fn from(hpa: &HorizontalPodAutoscaler) -> Self {
        let spec = hpa.spec.as_ref();
        let status = hpa.status.as_ref();

        Self {
            name: hpa.name_any(),
            namespace: K8sCommon::to_namespace(hpa.namespace()),
            min_replicas: spec.and_then(|s| s.min_replicas),
            max_replicas: spec.map(|s| s.max_replicas).unwrap_or_default(),
            current_replicas: status.map(|st| st.current_replicas.unwrap_or_default()),
            desired_replicas: status.map(|st| st.desired_replicas),
            target_ref: spec
                .map(|s| s.scale_target_ref.name.clone())
                .unwrap_or_default(),
            status: K8sHorizontalPodAutoscalers::extract_status(status),
            creation_timestamp: K8sCommon::to_creation_timestamp(hpa.metadata.clone()),
        }
    }
}

pub struct K8sHorizontalPodAutoscalers;

impl K8sHorizontalPodAutoscalers {
    pub async fn list(
        context_name: String,
        namespaces: Option<Vec<String>>,
    ) -> Result<Vec<HorizontalPodAutoscalerItem>, String> {
        K8sCommon::list_resources::<HorizontalPodAutoscaler, _, HorizontalPodAutoscalerItem>(
            &context_name,
            namespaces,
            |client, ns| {
                Box::pin(async move {
                    let api: Api<HorizontalPodAutoscaler> =
                        K8sClient::api::<HorizontalPodAutoscaler>(client, ns).await;
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
            let api: Api<HorizontalPodAutoscaler> =
                K8sClient::api::<HorizontalPodAutoscaler>(client.clone(), ns).await;
            K8sCommon::event_spawn_watch(
                app_handle.clone(),
                event_name.clone(),
                K8sCommon::watch_stream(&api).await?,
                Self::emit_event,
            );
        }

        Ok(())
    }

    fn emit_event(
        app_handle: &AppHandle,
        event_name: &str,
        kind: EventType,
        hpa: HorizontalPodAutoscaler,
    ) {
        K8sCommon::emit_event::<HorizontalPodAutoscaler, HorizontalPodAutoscalerItem>(
            app_handle, event_name, kind, hpa,
        );
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
}
