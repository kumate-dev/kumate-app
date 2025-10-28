use k8s_openapi::api::core::v1::{Node, NodeSpec, NodeStatus};
use kube::{api::ObjectMeta, Api, Client, ResourceExt};
use serde::Serialize;

use crate::{
    services::k8s::{client::K8sClient, common::K8sCommon},
    types::event::EventType,
    utils::bytes::Bytes,
};

#[derive(Serialize, Debug, Clone)]
pub struct NodeItem {
    pub name: String,
    pub cpu: Option<String>,
    pub memory: Option<String>,
    pub disk: Option<String>,
    pub taints: Option<String>,
    pub roles: Option<String>,
    pub version: Option<String>,
    pub condition: Option<String>,
    pub creation_timestamp: Option<String>,
}

impl From<Node> for NodeItem {
    fn from(n: Node) -> Self {
        let status: Option<NodeStatus> = n.status.clone();
        let spec: Option<NodeSpec> = n.spec.clone();
        let metadata: ObjectMeta = n.metadata.clone();

        Self {
            name: n.name_any(),
            cpu: K8sNodes::extract_cpu(status.clone()),
            memory: K8sNodes::extract_memory(status.clone()),
            disk: K8sNodes::extract_disk(status.clone()),
            taints: K8sNodes::extract_taints(spec.clone()),
            roles: K8sNodes::extract_roles(metadata.clone()),
            version: K8sNodes::extract_version(status.clone()),
            condition: K8sNodes::extract_condition(status.clone()),
            creation_timestamp: K8sCommon::to_creation_timestamp(metadata),
        }
    }
}

pub struct K8sNodes;

impl K8sNodes {
    pub async fn list(name: String) -> Result<Vec<NodeItem>, String> {
        K8sCommon::list_cluster_resources::<Node, _, _, _>(
            &name,
            |client| {
                Box::pin(async move {
                    let api: Api<Node> = Api::all(client);
                    let list = api
                        .list(&Default::default())
                        .await
                        .map_err(|e| e.to_string())?;
                    Ok(list.items)
                })
            },
            |n| n.into(),
        )
        .await
    }

    pub async fn watch(
        app_handle: tauri::AppHandle,
        name: String,
        event_name: String,
    ) -> Result<(), String> {
        let client: Client = K8sClient::for_context(&name).await?;
        let api: Api<Node> = Api::all(client);

        K8sCommon::event_spawn_watch(
            app_handle,
            event_name,
            K8sCommon::watch_stream(&api).await?,
            Self::emit_event,
        );

        Ok(())
    }

    fn emit_event(app_handle: &tauri::AppHandle, event_name: &str, kind: EventType, n: Node) {
        K8sCommon::emit_event::<Node, NodeItem>(app_handle, event_name, kind, n);
    }

    fn extract_version(status: Option<NodeStatus>) -> Option<String> {
        status
            .as_ref()
            .and_then(|s| s.node_info.as_ref())
            .map(|info| info.kubelet_version.clone())
    }

    fn extract_condition(status: Option<NodeStatus>) -> Option<String> {
        status
            .as_ref()
            .and_then(|s| s.conditions.as_ref())
            .and_then(|conds| {
                conds
                    .iter()
                    .find(|c| c.type_ == "Ready")
                    .map(|c| match c.status.as_str() {
                        "True" => "Ready".to_string(),
                        "Unknown" => "Unknown".to_string(),
                        _ => "NotReady".to_string(),
                    })
            })
    }

    fn extract_taints(spec: Option<NodeSpec>) -> Option<String> {
        spec.as_ref()
            .and_then(|sp| sp.taints.as_ref())
            .map(|taints| {
                taints
                    .iter()
                    .map(|t| {
                        let val = t
                            .value
                            .as_ref()
                            .map(|v| format!("={}", v))
                            .unwrap_or_default();
                        format!("{}{}:{}", t.key, val, t.effect)
                    })
                    .collect::<Vec<_>>()
                    .join(", ")
            })
    }

    fn extract_roles(metadata: kube::api::ObjectMeta) -> Option<String> {
        metadata.labels.as_ref().map(|labels| {
            labels
                .iter()
                .filter(|(k, v)| k.starts_with("node-role.kubernetes.io/") && v.as_str() == "true")
                .map(|(k, _)| k.trim_start_matches("node-role.kubernetes.io/").to_string())
                .collect::<Vec<_>>()
                .join(", ")
        })
    }

    fn extract_cpu(status: Option<NodeStatus>) -> Option<String> {
        status
            .as_ref()
            .and_then(|s| s.capacity.as_ref())
            .and_then(|cap| cap.get("cpu"))
            .map(|q| q.0.clone())
    }

    fn extract_memory(status: Option<NodeStatus>) -> Option<String> {
        status
            .as_ref()
            .and_then(|s| s.capacity.as_ref())
            .and_then(|cap| cap.get("memory"))
            .map(|q| Bytes::pretty_size(&q.0))
    }

    fn extract_disk(status: Option<NodeStatus>) -> Option<String> {
        status
            .as_ref()
            .and_then(|s| s.capacity.as_ref())
            .and_then(|cap| cap.get("ephemeral-storage"))
            .map(|q| Bytes::pretty_size(&q.0))
    }
}
