use std::collections::BTreeMap;
use std::pin::Pin;

use futures_util::{Stream, StreamExt};
use k8s_openapi::{
    api::core::v1::{Node, NodeCondition, NodeSpec, NodeStatus, NodeSystemInfo, Taint},
    apimachinery::pkg::api::resource::Quantity,
};
use kube::{
    api::{ListParams, ObjectList, ObjectMeta, WatchEvent, WatchParams},
    Api, Client,
};
use serde::Serialize;
use tauri::Emitter;

use crate::k8s::client::K8sClient;
use crate::types::event::EventType;
use crate::utils::bytes::Bytes;
use crate::utils::k8s::to_creation_timestamp;

#[derive(Serialize, Debug, Clone)]
pub struct NodeItem {
    pub name: String,
    pub cpu: Option<String>,
    pub memory: Option<String>,
    pub disk: Option<String>,
    pub taints: Option<String>,
    pub roles: Option<String>,
    pub version: Option<String>,
    pub creation_timestamp: Option<String>,
    pub condition: Option<String>,
}

#[derive(Serialize, Clone)]
struct NodeEvent {
    r#type: EventType,
    object: NodeItem,
}

pub struct K8sNodes;

impl K8sNodes {
    pub async fn list(name: String) -> Result<Vec<NodeItem>, String> {
        let client: Client = K8sClient::for_context(&name).await?;
        let nodes: Vec<Node> = Self::fetch(client).await?;
        let out: Vec<NodeItem> = nodes
            .into_iter()
            .map(|n: Node| Self::to_item(n))
            .collect::<Vec<_>>();
        Ok(out)
    }

    pub async fn watch(
        app_handle: tauri::AppHandle,
        name: String,
        event_name: String,
    ) -> Result<(), String> {
        let client: Client = K8sClient::for_context(&name).await?;
        let api: Api<Node> = Api::all(client);

        let mut stream: Pin<Box<dyn Stream<Item = Result<WatchEvent<Node>, kube::Error>> + Send>> =
            api.watch(&WatchParams::default(), "0")
                .await
                .map_err(|e| e.to_string())?
                .boxed();

        while let Some(status) = stream.next().await {
            match status {
                Ok(WatchEvent::Added(ns)) => {
                    Self::emit(&app_handle, &event_name, EventType::ADDED, ns)
                }
                Ok(WatchEvent::Modified(ns)) => {
                    Self::emit(&app_handle, &event_name, EventType::MODIFIED, ns)
                }
                Ok(WatchEvent::Deleted(ns)) => {
                    Self::emit(&app_handle, &event_name, EventType::DELETED, ns)
                }
                Err(e) => eprintln!("Node watch error: {}", e),
                _ => {}
            }
        }
        Ok(())
    }

    async fn fetch(client: Client) -> Result<Vec<Node>, String> {
        let api: Api<Node> = Api::all(client);
        let lp: ListParams = ListParams::default();
        let list: ObjectList<Node> = api
            .list(&lp)
            .await
            .map_err(|e: kube::Error| e.to_string())?;
        Ok(list.items)
    }

    fn to_item(n: Node) -> NodeItem {
        NodeItem {
            name: n.metadata.name.clone().unwrap_or_default(),
            cpu: Self::extract_cpu(n.status.clone()),
            memory: Self::extract_memory(n.status.clone()),
            disk: Self::extract_disk(n.status.clone()),
            taints: Self::extract_taints(n.spec.clone()),
            roles: Self::extract_roles(n.metadata.clone()),
            version: Self::extract_version(n.status.clone()),
            creation_timestamp: to_creation_timestamp(n.metadata.clone()),
            condition: Self::extract_condition(n.status.clone()),
        }
    }

    fn extract_version(status: Option<NodeStatus>) -> Option<String> {
        status
            .as_ref()
            .and_then(|s: &NodeStatus| s.node_info.as_ref())
            .map(|ni: &NodeSystemInfo| ni.kubelet_version.clone())
    }

    fn extract_condition(status: Option<NodeStatus>) -> Option<String> {
        status
            .as_ref()
            .and_then(|s: &NodeStatus| s.conditions.as_ref())
            .and_then(|cs: &Vec<NodeCondition>| {
                cs.iter()
                    .find(|c: &&NodeCondition| c.type_ == "Ready")
                    .map(|c: &NodeCondition| {
                        if c.status == "True" {
                            "Ready".to_string()
                        } else if c.status == "Unknown" {
                            "Unknown".to_string()
                        } else {
                            "NotReady".to_string()
                        }
                    })
            })
    }

    fn extract_taints(spec: Option<NodeSpec>) -> Option<String> {
        spec.as_ref()
            .and_then(|sp: &NodeSpec| sp.taints.as_ref())
            .map(|ts: &Vec<Taint>| {
                ts.iter()
                    .map(|t: &Taint| {
                        let val: String = t
                            .value
                            .as_ref()
                            .map(|v: &String| format!("={}", v))
                            .unwrap_or_default();
                        let eff: String = t.effect.clone();
                        format!("{}{}:{}", t.key, val, eff)
                    })
                    .collect::<Vec<_>>()
                    .join(", ")
            })
    }

    fn extract_roles(metadata: ObjectMeta) -> Option<String> {
        metadata
            .labels
            .as_ref()
            .map(|labels: &BTreeMap<String, String>| {
                labels
                    .iter()
                    .filter(|(k, v)| {
                        k.starts_with("node-role.kubernetes.io/") && v.as_str() == "true"
                    })
                    .map(|(k, _)| k.trim_start_matches("node-role.kubernetes.io/").to_string())
                    .collect::<Vec<_>>()
                    .join(", ")
            })
    }

    fn extract_cpu(status: Option<NodeStatus>) -> Option<String> {
        status
            .as_ref()
            .and_then(|s: &NodeStatus| s.capacity.as_ref())
            .and_then(|c: &BTreeMap<String, Quantity>| c.get("cpu"))
            .map(|q: &Quantity| q.0.clone())
    }

    fn extract_memory(status: Option<NodeStatus>) -> Option<String> {
        status
            .as_ref()
            .and_then(|s: &NodeStatus| s.capacity.as_ref())
            .and_then(|c: &BTreeMap<String, Quantity>| c.get("memory"))
            .map(|q: &Quantity| Bytes::pretty_size(&q.0))
    }

    fn extract_disk(status: Option<NodeStatus>) -> Option<String> {
        status
            .as_ref()
            .and_then(|s: &NodeStatus| s.capacity.as_ref())
            .and_then(|c: &BTreeMap<String, Quantity>| c.get("ephemeral-storage"))
            .map(|q: &Quantity| Bytes::pretty_size(&q.0))
    }

    fn emit(app_handle: &tauri::AppHandle, event_name: &str, kind: EventType, r: Node) {
        if r.metadata.name.is_some() {
            let item: NodeItem = Self::to_item(r);
            let event: NodeEvent = NodeEvent {
                r#type: kind,
                object: item,
            };
            let _ = app_handle.emit(event_name, event);
        }
    }
}
