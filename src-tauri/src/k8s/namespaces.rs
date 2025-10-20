use std::pin::Pin;

use futures_util::{Stream, StreamExt};
use k8s_openapi::{
    api::core::v1::{Namespace, NamespaceStatus},
    apimachinery::pkg::apis::meta::v1::Time,
};
use serde::Serialize;
use kube::{
    api::{ListParams, ObjectList, WatchEvent, WatchParams},
    Api, Client,
};
use tauri::Emitter;
use crate::k8s::client::K8sClient;

#[derive(Serialize, Debug, Clone)]
pub struct NamespaceItem {
    pub name: String,
    pub status: Option<String>,
    pub age: Option<String>,
}

#[derive(Serialize, Clone)]
struct NamespaceEvent {
    r#type: String, // ADDED / MODIFIED / DELETED
    object: NamespaceItem,
}

pub struct K8sNamespaces;

impl K8sNamespaces {
    pub async fn list(name: String) -> Result<Vec<NamespaceItem>, String> {
        let client: Client = K8sClient::for_context(&name).await?;
        let items: Vec<Namespace> = Self::fetch(client).await?;
        Ok(items.into_iter().map(Self::to_item).collect())
    }

    pub async fn watch(app_handle: tauri::AppHandle, name: String, event_name: String) -> Result<(), String> {
        let client: Client = K8sClient::for_context(&name).await?;
        let api: Api<Namespace> = Api::all(client);

        let mut stream: Pin<Box<dyn Stream<Item = Result<WatchEvent<Namespace>, kube::Error>> + Send>> = api
            .watch(&WatchParams::default(), "0")
            .await
            .map_err(|e| e.to_string())?
            .boxed(); 

        while let Some(status) = stream.next().await {
            match status {
                Ok(WatchEvent::Added(ns)) => Self::emit(&app_handle, &event_name, "ADDED", ns),
                Ok(WatchEvent::Modified(ns)) => Self::emit(&app_handle, &event_name, "MODIFIED", ns),
                Ok(WatchEvent::Deleted(ns)) => Self::emit(&app_handle, &event_name, "DELETED", ns),
                Err(e) => eprintln!("Watch error: {}", e),
                _ => {}
            }
        }
        Ok(())
    }

    async fn fetch(client: Client) -> Result<Vec<Namespace>, String> {
        let api: Api<Namespace> = Api::all(client);
        let lp: ListParams = ListParams::default();
        let list: ObjectList<Namespace> = api.list(&lp).await.map_err(|e| e.to_string())?;
        Ok(list.items)
    }

    fn to_item(n: Namespace) -> NamespaceItem {
        let name: String = n.metadata.name.unwrap_or_default();
        let status: Option<String> = n.status.and_then(|s: NamespaceStatus| s.phase);
        let age: Option<String> = n
            .metadata
            .creation_timestamp
            .as_ref()
            .map(|t: &Time| t.0.to_rfc3339());
        NamespaceItem { name, status, age }
    }

    fn emit(app_handle: &tauri::AppHandle, event_name: &str, kind: &str, ns: Namespace) {
      if ns.metadata.name.is_some() {
          let item: NamespaceItem = Self::to_item(ns);
          let event: NamespaceEvent = NamespaceEvent {
              r#type: kind.to_string(),
              object: item,
          };

          let _ = app_handle.emit(event_name, event);
      }
    }
}
