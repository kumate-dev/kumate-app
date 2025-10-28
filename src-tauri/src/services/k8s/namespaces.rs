use k8s_openapi::api::core::v1::{Namespace, NamespaceStatus};
use kube::{Api, Client, ResourceExt};
use serde::Serialize;

use crate::{
    services::k8s::{client::K8sClient, common::K8sCommon},
    types::event::EventType,
};

#[derive(Serialize, Debug, Clone)]
pub struct NamespaceItem {
    pub name: String,
    pub status: Option<String>,
    pub creation_timestamp: Option<String>,
}

impl From<Namespace> for NamespaceItem {
    fn from(n: Namespace) -> Self {
        Self {
            name: n.name_any(),
            status: n.status.and_then(|s: NamespaceStatus| s.phase),
            creation_timestamp: K8sCommon::to_creation_timestamp(n.metadata),
        }
    }
}

pub struct K8sNamespaces;

impl K8sNamespaces {
    pub async fn list(name: String) -> Result<Vec<NamespaceItem>, String> {
        K8sCommon::list_cluster_resources::<Namespace, _, _, _>(
            &name,
            |client| {
                Box::pin(async move {
                    let api: Api<Namespace> = Api::all(client);
                    let list = api
                        .list(&Default::default())
                        .await
                        .map_err(|e| e.to_string())?;
                    Ok(list.items)
                })
            },
            |ns| ns.into(),
        )
        .await
    }

    pub async fn watch(
        app_handle: tauri::AppHandle,
        name: String,
        event_name: String,
    ) -> Result<(), String> {
        let client: Client = K8sClient::for_context(&name).await?;
        let api: Api<Namespace> = Api::all(client);

        K8sCommon::event_spawn_watch(
            app_handle,
            event_name,
            K8sCommon::watch_stream(&api).await?,
            Self::emit_event,
        );

        Ok(())
    }

    fn emit_event(app_handle: &tauri::AppHandle, event_name: &str, kind: EventType, ns: Namespace) {
        K8sCommon::emit_event::<Namespace, NamespaceItem>(app_handle, event_name, kind, ns);
    }
}
