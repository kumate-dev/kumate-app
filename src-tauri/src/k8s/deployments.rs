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

use crate::k8s::common::K8sCommon;
use crate::types::event::EventType;

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
        let target_namespaces: Vec<Option<String>> = K8sCommon::get_target_namespaces(namespaces);

        let all_deployments: Vec<DeploymentItem> = join_all(
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

        Ok(all_deployments)
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
            let api: Api<Deployment> = K8sClient::api::<Deployment>(client.clone(), ns).await;

            K8sCommon::event_spawn_watch(
                app_handle.clone(),
                event_name.clone(),
                K8sCommon::watch_stream(&api).await?,
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
            namespace: K8sCommon::to_namespace(d.namespace()),
            ready: Self::extract_ready(&d),
            status: Self::extract_status(&d),
            creation_timestamp: K8sCommon::to_creation_timestamp(d.metadata),
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
        K8sCommon::to_replicas_ready(replicas, ready)
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

        Self::deployment_status(status)
    }

    fn deployment_status(status: &DeploymentStatus) -> Option<String> {
        let conditions: &Vec<DeploymentCondition> = status.conditions.as_ref()?;

        let available: Option<&DeploymentCondition> =
            conditions.iter().find(|c| c.type_ == "Available");
        let progressing: Option<&DeploymentCondition> =
            conditions.iter().find(|c| c.type_ == "Progressing");

        let available_status: Option<&str> = available.map(|c| c.status.as_str());
        let progressing_status: Option<&str> = progressing.map(|c| c.status.as_str());

        let replicas: i32 = status.replicas.unwrap_or(0);
        let ready_replicas: i32 = status.ready_replicas.unwrap_or(0);
        let updated_replicas: i32 = status.updated_replicas.unwrap_or(0);

        if progressing_status == Some("True")
            && available_status == Some("False")
            && (updated_replicas < replicas || ready_replicas < replicas)
        {
            return Some("Scaling".to_string());
        }

        match (available_status, progressing_status) {
            (Some("True"), Some("True")) => Some("Available".to_string()),
            (Some("False"), Some("True")) => Some("Scaling".to_string()),
            (Some("False"), Some("False")) => Some("Unavailable".to_string()),
            (_, Some("Unknown")) => Some("Progressing".to_string()),
            (Some("True"), _) => Some("Available".to_string()),
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
