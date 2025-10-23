use futures_util::future::join_all;
use k8s_openapi::api::core::v1::ConfigMap;
use kube::api::{ListParams, ObjectList};
use kube::{Api, Client, ResourceExt};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::k8s::common::K8sCommon;
use crate::types::event::EventType;

use super::client::K8sClient;

#[derive(Serialize, Debug, Clone)]
pub struct ConfigMapItem {
    pub name: String,
    pub namespace: String,
    pub data_keys: Vec<String>,
    pub creation_timestamp: Option<String>,
}

#[derive(Serialize, Clone)]
struct ConfigMapEvent {
    r#type: EventType,
    object: ConfigMapItem,
}

pub struct K8sConfigMaps;

impl K8sConfigMaps {
    pub async fn list(
        name: String,
        namespaces: Option<Vec<String>>,
    ) -> Result<Vec<ConfigMapItem>, String> {
        let client: Client = K8sClient::for_context(&name).await?;
        let target_namespaces: Vec<Option<String>> = K8sCommon::get_target_namespaces(namespaces);

        let all_configmaps: Vec<ConfigMapItem> = join_all(
            target_namespaces
                .into_iter()
                .map(|ns| Self::fetch(client.clone(), ns)),
        )
        .await
        .into_iter()
        .collect::<Result<Vec<_>, _>>()?
        .into_iter()
        .flatten()
        .map(Self::to_item)
        .collect();

        Ok(all_configmaps)
    }

    pub async fn watch(
        app_handle: AppHandle,
        name: String,
        namespaces: Option<Vec<String>>,
        event_name: String,
    ) -> Result<(), String> {
        let client: Client = K8sClient::for_context(&name).await?;
        let target_namespaces: Vec<Option<String>> = K8sCommon::get_target_namespaces(namespaces);

        for ns in target_namespaces {
            let api: Api<ConfigMap> = K8sClient::api::<ConfigMap>(client.clone(), ns).await;

            K8sCommon::event_spawn_watch(   
                app_handle.clone(),
                event_name.clone(),
                K8sCommon::watch_stream(&api).await?,
                Self::emit,
            );
        }

        Ok(())
    }

    async fn fetch(client: Client, namespace: Option<String>) -> Result<Vec<ConfigMap>, String> {
        let api: Api<ConfigMap> = K8sClient::api::<ConfigMap>(client, namespace).await;
        let lp: ListParams = ListParams::default();
        let list: ObjectList<ConfigMap> = api.list(&lp).await.map_err(|e| e.to_string())?;
        Ok(list.items)
    }

    fn to_item(cm: ConfigMap) -> ConfigMapItem {
        let keys: Vec<String> = cm
            .data
            .as_ref()
            .map(|d| d.keys().cloned().collect())
            .unwrap_or_default();

        ConfigMapItem {
            name: cm.name_any(),
            namespace: K8sCommon::to_namespace(cm.namespace()),
            data_keys: keys,
            creation_timestamp: K8sCommon::to_creation_timestamp(cm.metadata.clone()),
        }
    }

    fn emit(app_handle: &tauri::AppHandle, event_name: &str, kind: EventType, cm: ConfigMap) {
        if cm.metadata.name.is_some() {
            let item: ConfigMapItem = Self::to_item(cm);
            let event: ConfigMapEvent = ConfigMapEvent {
                r#type: kind,
                object: item,
            };
            let _ = app_handle.emit(event_name, event);
        }
    }
}
