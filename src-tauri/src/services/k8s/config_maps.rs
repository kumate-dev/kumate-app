use k8s_openapi::api::core::v1::ConfigMap;
use kube::{Api, Client, ResourceExt};
use serde::Serialize;

use crate::{
    services::k8s::{client::K8sClient, common::K8sCommon},
    types::event::EventType,
};

#[derive(Serialize, Debug, Clone)]
pub struct ConfigMapItem {
    pub name: String,
    pub namespace: String,
    pub data_keys: Vec<String>,
    pub creation_timestamp: Option<String>,
}

impl From<ConfigMap> for ConfigMapItem {
    fn from(cm: ConfigMap) -> Self {
        (&cm).into()
    }
}

impl From<&ConfigMap> for ConfigMapItem {
    fn from(cm: &ConfigMap) -> Self {
        let keys: Vec<String> = cm
            .data
            .as_ref()
            .map(|d| d.keys().cloned().collect())
            .unwrap_or_default();

        Self {
            name: cm.name_any(),
            namespace: K8sCommon::to_namespace(cm.namespace()),
            data_keys: keys,
            creation_timestamp: K8sCommon::to_creation_timestamp(cm.metadata.clone()),
        }
    }
}

pub struct K8sConfigMaps;

impl K8sConfigMaps {
    pub async fn list(
        context_name: String,
        namespaces: Option<Vec<String>>,
    ) -> Result<Vec<ConfigMapItem>, String> {
        K8sCommon::list_resources::<ConfigMap, _, ConfigMapItem>(
            &context_name,
            namespaces,
            |client, namespace| {
                Box::pin(async move {
                    let api: Api<ConfigMap> = K8sClient::api::<ConfigMap>(client, namespace).await;
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
        app_handle: tauri::AppHandle,
        context_name: String,
        namespaces: Option<Vec<String>>,
        event_name: String,
    ) -> Result<(), String> {
        let client: Client = K8sClient::for_context(&context_name).await?;
        let target_namespaces: Vec<Option<String>> = K8sCommon::get_target_namespaces(namespaces);

        for ns in target_namespaces {
            let api: Api<ConfigMap> = K8sClient::api::<ConfigMap>(client.clone(), ns).await;

            K8sCommon::event_spawn_watch(
                app_handle.clone(),
                event_name.clone(),
                K8sCommon::watch_stream(&api).await?,
                Self::emit_event,
            );
        }

        Ok(())
    }

    fn emit_event(app_handle: &tauri::AppHandle, event_name: &str, kind: EventType, cm: ConfigMap) {
        K8sCommon::emit_event::<ConfigMap, ConfigMapItem>(app_handle, event_name, kind, cm);
    }
}
