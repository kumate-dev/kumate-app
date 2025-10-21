use k8s_openapi::api::core::v1::{Namespace, NamespaceStatus};
use kube::{
    api::{ListParams, ObjectList},
    Api, Client,
};
use serde::Serialize;
use tauri::Emitter;

use crate::{
    k8s::client::K8sClient,
    types::event::EventType,
    utils::k8s::{event_spawn_watch, to_creation_timestamp, watch_stream},
};

#[derive(Serialize, Debug, Clone)]
pub struct NamespaceItem {
    pub name: String,
    pub status: Option<String>,
    pub creation_timestamp: Option<String>,
}

#[derive(Serialize, Clone)]
struct NamespaceEvent {
    r#type: EventType,
    object: NamespaceItem,
}

pub struct K8sNamespaces;

impl K8sNamespaces {
    pub async fn list(name: String) -> Result<Vec<NamespaceItem>, String> {
        let client: Client = K8sClient::for_context(&name).await?;
        let namespaces: Vec<Namespace> = Self::fetch(client).await?;
        Ok(namespaces.into_iter().map(Self::to_item).collect())
    }

    pub async fn watch(
        app_handle: tauri::AppHandle,
        name: String,
        event_name: String,
    ) -> Result<(), String> {
        let client: Client = K8sClient::for_context(&name).await?;
        let api: Api<Namespace> = Api::all(client);

        event_spawn_watch(
            app_handle,
            event_name,
            watch_stream(&api).await?,
            Self::emit,
        );

        Ok(())
    }

    async fn fetch(client: Client) -> Result<Vec<Namespace>, String> {
        let api: Api<Namespace> = Api::all(client);
        let lp: ListParams = ListParams::default();
        let list: ObjectList<Namespace> = api.list(&lp).await.map_err(|e| e.to_string())?;
        Ok(list.items)
    }

    fn to_item(n: Namespace) -> NamespaceItem {
        NamespaceItem {
            name: n.metadata.clone().name.unwrap_or_default(),
            status: n.status.and_then(|s: NamespaceStatus| s.phase),
            creation_timestamp: to_creation_timestamp(n.metadata.clone()),
        }
    }

    fn emit(app_handle: &tauri::AppHandle, event_name: &str, kind: EventType, ns: Namespace) {
        if ns.metadata.name.is_some() {
            let item: NamespaceItem = Self::to_item(ns);
            let event: NamespaceEvent = NamespaceEvent {
                r#type: kind,
                object: item,
            };

            let _ = app_handle.emit(event_name, event);
        }
    }
}
