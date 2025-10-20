use k8s_openapi::api::apps::v1::{Deployment, DeploymentCondition, DeploymentSpec, DeploymentStatus};
use k8s_openapi::apimachinery::pkg::apis::meta::v1::Time;
use kube::{Api, ResourceExt, Client};
use kube::api::{ListParams, ObjectList};
use serde::Serialize;

use super::client::K8sClient;

#[derive(Serialize, Debug, Clone)]
pub struct DeploymentItem {
    pub name: String,
    pub namespace: String,
    pub ready: String,
    pub creation_timestamp: Option<String>,
    pub status: Option<String>,
}

pub struct K8sDeployments;

impl K8sDeployments {
    pub async fn list(name: String, namespace: Option<String>) -> Result<Vec<DeploymentItem>, String> {
        let client: Client = K8sClient::for_context(&name).await?;
        let deps: Vec<Deployment> = Self::fetch(client, namespace).await?;
        let mut out: Vec<DeploymentItem> = deps.into_iter().map(Self::to_item).collect();
        out.sort_by(|a: &DeploymentItem, b: &DeploymentItem| a.name.cmp(&b.name));
        Ok(out)
    }

    async fn fetch(client: Client, namespace: Option<String>) -> Result<Vec<Deployment>, String> {
        let api: Api<Deployment> = K8sClient::api::<Deployment>(client, namespace).await;
        let lp: ListParams = ListParams::default();
        let list: ObjectList<Deployment> = api.list(&lp).await.map_err(|e| e.to_string())?;
        Ok(list.items)
    }

    fn to_item(d: Deployment) -> DeploymentItem {
        let replicas: i32 = d.spec.as_ref().and_then(|s: &DeploymentSpec| s.replicas).unwrap_or(0);
        let ready: i32 = d.status.as_ref().and_then(|s: &DeploymentStatus| s.ready_replicas).unwrap_or(0);
        let status: Option<String> = Self::extract_status(&d);
        DeploymentItem {
            name: d.name_any(),
            namespace: d.namespace().unwrap_or_else(|| "default".to_string()),
            ready: format!("{}/{}", ready, replicas),
            creation_timestamp: d.metadata.creation_timestamp.as_ref().map(|t: &Time| t.0.to_rfc3339()),
            status,
        }
    }

    fn extract_status(d: &Deployment) -> Option<String> {
        if d.metadata.deletion_timestamp.is_some() {
            return Some("Terminating".to_string());
        }
        let cs: &Vec<DeploymentCondition> = d.status.as_ref().and_then(|s| s.conditions.as_ref())?;
        if cs.iter().any(|c: &DeploymentCondition| c.type_ == "ReplicaFailure" && c.status == "True") {
            return Some("Failed".to_string());
        }
        if cs.iter().any(|c: &DeploymentCondition| c.type_ == "Available" && c.status == "True") {
            return Some("Available".to_string());
        }
        if cs.iter().any(|c: &DeploymentCondition| c.type_ == "Progressing" && c.status == "True") {
            return Some("Progressing".to_string());
        }
        None
    }
}