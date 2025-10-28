use kube::{Api, Client, ResourceExt};
use serde::Serialize;
use tauri::AppHandle;

use super::client::K8sClient;
use crate::{services::k8s::common::K8sCommon, types::event::EventType};
use k8s_openapi::api::core::v1::{
    ReplicationController, ReplicationControllerSpec, ReplicationControllerStatus,
};

#[derive(Serialize, Debug, Clone)]
pub struct ReplicationControllerItem {
    pub name: String,
    pub namespace: String,
    pub ready: String,
    pub creation_timestamp: Option<String>,
}

impl From<ReplicationController> for ReplicationControllerItem {
    fn from(rc: ReplicationController) -> Self {
        (&rc).into()
    }
}

impl From<&ReplicationController> for ReplicationControllerItem {
    fn from(rc: &ReplicationController) -> Self {
        Self {
            name: rc.name_any(),
            namespace: K8sCommon::to_namespace(rc.namespace()),
            ready: K8sReplicationControllers::extract_ready(rc),
            creation_timestamp: K8sCommon::to_creation_timestamp(rc.metadata.clone()),
        }
    }
}

pub struct K8sReplicationControllers;

impl K8sReplicationControllers {
    pub async fn list(
        context_name: String,
        namespaces: Option<Vec<String>>,
    ) -> Result<Vec<ReplicationControllerItem>, String> {
        K8sCommon::list_resources::<ReplicationController, _, ReplicationControllerItem>(
            &context_name,
            namespaces,
            |client, ns| {
                Box::pin(async move {
                    let api: Api<ReplicationController> =
                        K8sClient::api::<ReplicationController>(client, ns).await;
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
        let target_namespaces: Vec<Option<String>> = K8sCommon::get_target_namespaces(namespaces);

        for ns in target_namespaces {
            let api: Api<ReplicationController> =
                K8sClient::api::<ReplicationController>(client.clone(), ns).await;
            K8sCommon::event_spawn_watch(
                app_handle.clone(),
                event_name.clone(),
                K8sCommon::watch_stream(&api).await?,
                Self::emit_event,
            );
        }

        Ok(())
    }

    fn emit_event(
        app_handle: &AppHandle,
        event_name: &str,
        kind: EventType,
        rc: ReplicationController,
    ) {
        K8sCommon::emit_event::<ReplicationController, ReplicationControllerItem>(
            app_handle, event_name, kind, rc,
        );
    }

    fn extract_ready(rc: &ReplicationController) -> String {
        let replicas: i32 = rc
            .spec
            .as_ref()
            .and_then(|s: &ReplicationControllerSpec| s.replicas)
            .unwrap_or(0);
        let ready: i32 = rc
            .status
            .as_ref()
            .and_then(|s: &ReplicationControllerStatus| s.ready_replicas)
            .unwrap_or(0);
        K8sCommon::to_replicas_ready(replicas, ready)
    }
}
