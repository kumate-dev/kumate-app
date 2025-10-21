use futures_util::future::join_all;
use k8s_openapi::api::apps::v1::{
    Deployment, DeploymentCondition, DeploymentSpec, DeploymentStatus,
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
pub struct DeploymentItem {
    pub name: String,
    pub namespace: String,
    pub ready: String,
    pub creation_timestamp: Option<String>,
    pub status: Option<String>,
}

#[derive(Serialize, Clone)]
struct DeploymentEvent {
    r#type: EventType,
    object: DeploymentItem,
}

pub struct K8sDeployments;

impl K8sDeployments {
    pub async fn list(
        name: String,
        namespaces: Option<Vec<String>>,
    ) -> Result<Vec<DeploymentItem>, String> {
        let client: Client = K8sClient::for_context(&name).await?;
        let target_namespaces: Vec<String> = get_target_namespaces(namespaces);

        let all_deployments: Vec<DeploymentItem> = if target_namespaces.is_empty() {
            Self::fetch(client.clone(), None)
                .await?
                .into_iter()
                .map(Self::to_item)
                .collect()
        } else {
            let results: Vec<Vec<Deployment>> = join_all(
                target_namespaces
                    .into_iter()
                    .map(|ns| Self::fetch(client.clone(), Some(ns))),
            )
            .await
            .into_iter()
            .collect::<Result<Vec<_>, _>>()?;
            results.into_iter().flatten().map(Self::to_item).collect()
        };

        Ok(all_deployments)
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
            let api: Api<Deployment> = K8sClient::api::<Deployment>(
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

    async fn fetch(client: Client, namespace: Option<String>) -> Result<Vec<Deployment>, String> {
        let api: Api<Deployment> = K8sClient::api::<Deployment>(client, namespace).await;
        let lp: ListParams = ListParams::default();
        let list: ObjectList<Deployment> = api.list(&lp).await.map_err(|e| e.to_string())?;
        Ok(list.items)
    }

    fn to_item(d: Deployment) -> DeploymentItem {
        DeploymentItem {
            name: d.name_any(),
            namespace: to_namespace(d.namespace()),
            ready: Self::extract_ready(&d),
            status: Self::extract_status(&d),
            creation_timestamp: to_creation_timestamp(d.metadata),
        }
    }

    fn extract_ready(d: &Deployment) -> String {
        let replicas: i32 = d
            .spec
            .as_ref()
            .and_then(|s: &DeploymentSpec| s.replicas)
            .unwrap_or(0);
        let ready: i32 = d
            .status
            .as_ref()
            .and_then(|s: &DeploymentStatus| s.ready_replicas)
            .unwrap_or(0);
        to_replicas_ready(replicas, ready)
    }

    fn extract_status(d: &Deployment) -> Option<String> {
        if d.metadata.deletion_timestamp.is_some() {
            return Some("Terminating".to_string());
        }

        let status: &DeploymentStatus = d.status.as_ref()?;
        let conditions: &Vec<DeploymentCondition> = status.conditions.as_ref()?;

        if conditions
            .iter()
            .any(|c| c.type_ == "ReplicaFailure" && c.status == "True")
        {
            return Some("Failed".to_string());
        }

        let available: Option<&DeploymentCondition> =
            conditions.iter().find(|c| c.type_ == "Available");
        let progressing: Option<&DeploymentCondition> =
            conditions.iter().find(|c| c.type_ == "Progressing");

        match (
            available.map(|c| c.status.as_str()),
            progressing.map(|c| c.status.as_str()),
        ) {
            (Some("True"), Some("True")) => Some("Scaling".to_string()),
            (Some("True"), _) => Some("Available".to_string()),
            (Some("False"), Some("True")) => Some("Progressing".to_string()),
            (Some("False"), Some("False")) => Some("Unavailable".to_string()),
            (_, Some("Unknown")) => Some("Progressing".to_string()),
            _ => Some("Unknown".to_string()),
        }
    }

    fn emit(app_handle: &tauri::AppHandle, event_name: &str, kind: EventType, d: Deployment) {
        if d.metadata.name.is_some() {
            let item: DeploymentItem = Self::to_item(d);
            let event: DeploymentEvent = DeploymentEvent {
                r#type: kind,
                object: item,
            };
            let _ = app_handle.emit(event_name, event);
        }
    }
}
