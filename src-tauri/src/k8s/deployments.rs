use kube::{Api, Client, ResourceExt};
use serde::Serialize;
use tauri::AppHandle;

use super::client::K8sClient;
use crate::k8s::common::K8sCommon;
use crate::types::event::EventType;
use k8s_openapi::api::apps::v1::{
    Deployment, DeploymentCondition, DeploymentSpec, DeploymentStatus,
};

#[derive(Serialize, Debug, Clone)]
pub struct DeploymentItem {
    pub name: String,
    pub namespace: String,
    pub ready: String,
    pub creation_timestamp: Option<String>,
    pub status: Option<String>,
}

impl From<Deployment> for DeploymentItem {
    fn from(d: Deployment) -> Self {
        (&d).into()
    }
}

impl From<&Deployment> for DeploymentItem {
    fn from(d: &Deployment) -> Self {
        Self {
            name: d.name_any(),
            namespace: K8sCommon::to_namespace(d.namespace()),
            ready: K8sDeployments::extract_ready(d),
            status: K8sDeployments::extract_status(d),
            creation_timestamp: K8sCommon::to_creation_timestamp(d.metadata.clone()),
        }
    }
}

pub struct K8sDeployments;

impl K8sDeployments {
    pub async fn list(
        context_name: String,
        namespaces: Option<Vec<String>>,
    ) -> Result<Vec<DeploymentItem>, String> {
        K8sCommon::list_resources::<Deployment, _, DeploymentItem>(
            &context_name,
            namespaces,
            |client, ns| {
                Box::pin(async move {
                    let api: Api<Deployment> = K8sClient::api::<Deployment>(client, ns).await;
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
        let target_namespaces = K8sCommon::get_target_namespaces(namespaces);

        for ns in target_namespaces {
            let api: Api<Deployment> = K8sClient::api::<Deployment>(client.clone(), ns).await;
            K8sCommon::event_spawn_watch(
                app_handle.clone(),
                event_name.clone(),
                K8sCommon::watch_stream(&api).await?,
                Self::emit_event,
            );
        }

        Ok(())
    }

    pub async fn delete(
        name: String,
        namespace: Option<String>,
        deployment_names: Vec<String>,
    ) -> Result<Vec<Result<String, String>>, String> {
        K8sCommon::delete_resources::<Deployment, _, _>(
            &name,
            namespace,
            deployment_names,
            |client: kube::Client, ns: Option<String>| {
                Box::pin(K8sClient::api::<Deployment>(client, ns))
            },
        )
        .await
    }

    fn emit_event(app_handle: &AppHandle, event_name: &str, kind: EventType, d: Deployment) {
        K8sCommon::emit_event::<Deployment, DeploymentItem>(app_handle, event_name, kind, d);
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

        let available = conditions.iter().find(|c| c.type_ == "Available");
        let progressing = conditions.iter().find(|c| c.type_ == "Progressing");

        let available_status = available.map(|c| c.status.as_str());
        let progressing_status = progressing.map(|c| c.status.as_str());

        let replicas = status.replicas.unwrap_or(0);
        let ready_replicas = status.ready_replicas.unwrap_or(0);
        let updated_replicas = status.updated_replicas.unwrap_or(0);

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
}
