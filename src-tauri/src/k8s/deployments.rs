use futures_util::{Stream, StreamExt};
use k8s_openapi::api::apps::v1::{
    Deployment, DeploymentCondition, DeploymentSpec, DeploymentStatus,
};
use k8s_openapi::apimachinery::pkg::apis::meta::v1::Time;
use kube::{
    api::{ListParams, ObjectList, WatchEvent, WatchParams},
    Api, Client, ResourceExt,
};
use serde::Serialize;
use std::pin::Pin;
use tauri::Emitter;

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
    r#type: String, // ADDED / MODIFIED / DELETED
    object: DeploymentItem,
}

pub struct K8sDeployments;

impl K8sDeployments {
    pub async fn list(
        name: String,
        namespace: Option<String>,
    ) -> Result<Vec<DeploymentItem>, String> {
        let client: Client = K8sClient::for_context(&name).await?;
        let deps: Vec<Deployment> = Self::fetch(client, namespace).await?;
        let mut out: Vec<DeploymentItem> = deps.into_iter().map(Self::to_item).collect();
        out.sort_by(|a: &DeploymentItem, b: &DeploymentItem| a.name.cmp(&b.name));
        Ok(out)
    }

    /// Watch deployments for real-time updates
    pub async fn watch(
        app_handle: tauri::AppHandle,
        name: String,
        namespace: Option<String>,
        event_name: String,
    ) -> Result<(), String> {
        let client: Client = K8sClient::for_context(&name).await?;
        let api: Api<Deployment> = K8sClient::api::<Deployment>(client, namespace).await;

        let mut stream: Pin<
            Box<dyn Stream<Item = Result<WatchEvent<Deployment>, kube::Error>> + Send>,
        > = api
            .watch(&WatchParams::default(), "0")
            .await
            .map_err(|e| e.to_string())?
            .boxed();

        while let Some(status) = stream.next().await {
            match status {
                Ok(WatchEvent::Added(dep)) => Self::emit(&app_handle, &event_name, "ADDED", dep),
                Ok(WatchEvent::Modified(dep)) => {
                    Self::emit(&app_handle, &event_name, "MODIFIED", dep)
                }
                Ok(WatchEvent::Deleted(dep)) => {
                    Self::emit(&app_handle, &event_name, "DELETED", dep)
                }
                Err(e) => eprintln!("Deployment watch error: {}", e),
                _ => {}
            }
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
        let status: Option<String> = Self::extract_status(&d);
        DeploymentItem {
            name: d.name_any(),
            namespace: d.namespace().unwrap_or_else(|| "default".to_string()),
            ready: format!("{}/{}", ready, replicas),
            creation_timestamp: d
                .metadata
                .creation_timestamp
                .as_ref()
                .map(|t: &Time| t.0.to_rfc3339()),
            status,
        }
    }

    fn extract_status(d: &Deployment) -> Option<String> {
        if d.metadata.deletion_timestamp.is_some() {
            return Some("Terminating".to_string());
        }
        let cs: &Vec<DeploymentCondition> =
            d.status.as_ref().and_then(|s| s.conditions.as_ref())?;
        if cs
            .iter()
            .any(|c: &DeploymentCondition| c.type_ == "ReplicaFailure" && c.status == "True")
        {
            return Some("Failed".to_string());
        }
        if cs
            .iter()
            .any(|c: &DeploymentCondition| c.type_ == "Available" && c.status == "True")
        {
            return Some("Available".to_string());
        }
        if cs
            .iter()
            .any(|c: &DeploymentCondition| c.type_ == "Progressing" && c.status == "True")
        {
            return Some("Progressing".to_string());
        }
        None
    }

    fn emit(app_handle: &tauri::AppHandle, event_name: &str, kind: &str, d: Deployment) {
        if d.metadata.name.is_some() {
            let item: DeploymentItem = Self::to_item(d);
            let event: DeploymentEvent = DeploymentEvent {
                r#type: kind.to_string(),
                object: item,
            };
            let _ = app_handle.emit(event_name, event);
        }
    }
}
