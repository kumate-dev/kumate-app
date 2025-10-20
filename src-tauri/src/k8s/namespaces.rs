use k8s_openapi::{api::core::v1::{Namespace, NamespaceStatus}, apimachinery::pkg::apis::meta::v1::Time};
use serde::Serialize;
use kube::{api::{ListParams, ObjectList}, Api, Client};

use crate::k8s::client::K8sClient;

#[derive(Serialize, Debug, Clone)]
pub struct NamespaceItem {
  pub name: String,
  pub status: Option<String>,
  pub age: Option<String>,
}

pub struct K8sNamespaces;

impl K8sNamespaces {
  pub async fn list(name: String) -> Result<Vec<NamespaceItem>, String> {
    let client: Client = K8sClient::for_context(&name).await?;
    let items: Vec<Namespace> = Self::fetch(client).await?;
    Ok(items.into_iter().map(Self::to_item).collect())
  }

  async fn fetch(client: Client) -> Result<Vec<Namespace>, String> {
    let api: Api<Namespace> = Api::all(client);
    let lp: ListParams = ListParams::default();
    let list: ObjectList<Namespace> = api.list(&lp).await.map_err(|e: kube::Error| e.to_string())?;
    Ok(list.items)
  }

  fn to_item(n: Namespace) -> NamespaceItem {
    let name: String = n.metadata.name.unwrap_or_default();
    let status: Option<String> = n.status.and_then(|s: NamespaceStatus| s.phase);
    let age: Option<String> = n.metadata.creation_timestamp.as_ref().map(|t: &Time| t.0.to_rfc3339());
    NamespaceItem { name, status, age }
  }
}