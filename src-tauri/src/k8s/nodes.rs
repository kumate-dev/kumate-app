use std::collections::BTreeMap;

use k8s_openapi::api::core::v1::{Node, NodeCondition, NodeSpec, NodeStatus, NodeSystemInfo, Taint};
use k8s_openapi::apimachinery::pkg::api::resource::Quantity;
use k8s_openapi::apimachinery::pkg::apis::meta::v1::Time;
use serde::Serialize;
use kube::{Api, Client};
use kube::api::{ListParams, ObjectList};

use crate::k8s::client::K8sClient;
use crate::utils::bytes::Bytes;

#[derive(Serialize, Debug, Clone)]
pub struct NodeItem {
  pub name: String,
  pub cpu: Option<String>,
  pub memory: Option<String>,
  pub disk: Option<String>,
  pub taints: Option<String>,
  pub roles: Option<String>,
  pub version: Option<String>,
  pub age: Option<String>,
  pub condition: Option<String>,
}

pub struct K8sNodes;

impl K8sNodes {
  pub async fn list(name: String) -> Result<Vec<NodeItem>, String> {
    let client: Client = K8sClient::for_context(&name).await?;
    let nodes: Vec<Node> = Self::fetch(client).await?;
    let out: Vec<NodeItem> = nodes.into_iter().map(|n: Node| Self::to_item(n)).collect::<Vec<_>>();
    Ok(out)
  }

  async fn fetch(client: Client) -> Result<Vec<Node>, String> {
    let api: Api<Node> = Api::all(client);
    let lp: ListParams = ListParams::default();
    let list: ObjectList<Node> = api.list(&lp).await.map_err(|e: kube::Error| e.to_string())?;
    Ok(list.items)
  }

  fn to_item(n: Node) -> NodeItem {
    let name: String = n.metadata.name.clone().unwrap_or_default();
    let age: Option<String> = Self::extract_age(&n);
    let version: Option<String> = Self::extract_version(&n);
    let condition: Option<String> = Self::extract_condition(&n);
    let taints: Option<String> = Self::extract_taints(&n);
    let roles: Option<String> = Self::extract_roles(&n);
    let cpu: Option<String> = Self::extract_cpu(&n);
    let memory: Option<String> = Self::extract_memory(&n);
    let disk: Option<String> = Self::extract_disk(&n);

    NodeItem { name, cpu, memory, disk, taints, roles, version, age, condition }
  }

  fn extract_age(n: &Node) -> Option<String> {
    n.metadata.creation_timestamp.as_ref().map(|t: &Time| t.0.to_rfc3339())
  }

  fn extract_version(n: &Node) -> Option<String> {
    n.status.as_ref().and_then(|s: &NodeStatus| s.node_info.as_ref()).map(|ni: &NodeSystemInfo| ni.kubelet_version.clone())
  }

  fn extract_condition(n: &Node) -> Option<String> {
    n.status.as_ref().and_then(|s: &NodeStatus| s.conditions.as_ref()).and_then(|cs: &Vec<NodeCondition>| {
      cs.iter().find(|c: &&NodeCondition| c.type_ == "Ready").map(|c: &NodeCondition| {
        if c.status == "True" { "Ready".to_string() }
        else if c.status == "Unknown" { "Unknown".to_string() }
        else { "NotReady".to_string() }
      })
    })
  }

  fn extract_taints(n: &Node) -> Option<String> {
    n.spec.as_ref().and_then(|sp: &NodeSpec| sp.taints.as_ref()).map(|ts: &Vec<Taint>| {
      ts.iter().map(|t: &Taint| {
        let val: String = t.value.as_ref().map(|v: &String| format!("={}", v)).unwrap_or_default();
        let eff: String = t.effect.clone();
        format!("{}{}:{}", t.key, val, eff)
      }).collect::<Vec<_>>().join(", ")
    })
  }

  fn extract_roles(n: &Node) -> Option<String> {
    n.metadata.labels.as_ref().map(|labels: &BTreeMap<String, String>| {
      labels.iter().filter(|(k, v)| k.starts_with("node-role.kubernetes.io/") && v.as_str() == "true")
        .map(|(k, _)| k.trim_start_matches("node-role.kubernetes.io/").to_string())
        .collect::<Vec<_>>().join(", ")
    })
  }

  fn extract_cpu(n: &Node) -> Option<String> {
    n.status.as_ref().and_then(|s: &NodeStatus| s.capacity.as_ref()).and_then(|c: &BTreeMap<String, Quantity>| c.get("cpu")).map(|q: &Quantity| q.0.clone())
  }

  fn extract_memory(n: &Node) -> Option<String> {
    n.status.as_ref().and_then(|s: &NodeStatus| s.capacity.as_ref()).and_then(|c: &BTreeMap<String, Quantity>| c.get("memory")).map(|q: &Quantity| Bytes::pretty_size(&q.0))
  }

  fn extract_disk(n: &Node) -> Option<String> {
    n.status.as_ref().and_then(|s: &NodeStatus| s.capacity.as_ref()).and_then(|c: &BTreeMap<String, Quantity>| c.get("ephemeral-storage")).map(|q: &Quantity| Bytes::pretty_size(&q.0))
  }
}