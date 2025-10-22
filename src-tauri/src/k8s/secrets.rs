use futures_util::future::join_all;
use k8s_openapi::api::core::v1::Secret;
use kube::api::{ListParams, ObjectList};
use kube::{Api, Client, ResourceExt};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::types::event::EventType;
use crate::utils::k8s::{
    event_spawn_watch, get_target_namespaces, to_creation_timestamp, to_namespace, watch_stream,
};

use super::client::K8sClient;

#[derive(Serialize, Debug, Clone)]
pub struct SecretItem {
    pub name: String,
    pub namespace: String,
    pub type_: String,
    pub data_keys: Vec<String>,
    pub creation_timestamp: Option<String>,
}

#[derive(Serialize, Clone)]
struct SecretEvent {
    r#type: EventType,
    object: SecretItem,
}

pub struct K8sSecrets;

impl K8sSecrets {
    pub async fn list(
        name: String,
        namespaces: Option<Vec<String>>,
    ) -> Result<Vec<SecretItem>, String> {
        let client: Client = K8sClient::for_context(&name).await?;
        let target_namespaces: Vec<Option<String>> = get_target_namespaces(namespaces);

        let all_items: Vec<SecretItem> = join_all(
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

        Ok(all_items)
    }

    pub async fn watch(
        app_handle: AppHandle,
        name: String,
        namespaces: Option<Vec<String>>,
        event_name: String,
    ) -> Result<(), String> {
        let client: Client = K8sClient::for_context(&name).await?;
        let target_namespaces: Vec<Option<String>> = get_target_namespaces(namespaces);

        for ns in target_namespaces {
            let api: Api<Secret> = K8sClient::api::<Secret>(client.clone(), ns).await;

            event_spawn_watch(
                app_handle.clone(),
                event_name.clone(),
                watch_stream(&api).await?,
                Self::emit,
            );
        }

        Ok(())
    }

    async fn fetch(client: Client, namespace: Option<String>) -> Result<Vec<Secret>, String> {
        let api: Api<Secret> = K8sClient::api::<Secret>(client, namespace).await;
        let lp: ListParams = ListParams::default();
        let list: ObjectList<Secret> = api.list(&lp).await.map_err(|e| e.to_string())?;
        Ok(list.items)
    }

    fn to_item(secret: Secret) -> SecretItem {
        let keys: Vec<String> = secret
            .data
            .as_ref() // <-- borrow thay vì move
            .map(|m| m.keys().cloned().collect())
            .unwrap_or_default();

        SecretItem {
            name: secret.name_any(),
            namespace: to_namespace(secret.namespace()),
            type_: secret.type_.unwrap_or_default().to_string(),
            data_keys: keys,
            creation_timestamp: to_creation_timestamp(secret.metadata.clone()),
        }
    }

    fn emit(app_handle: &AppHandle, event_name: &str, kind: EventType, secret: Secret) {
        if secret.metadata.name.is_some() {
            let item: SecretItem = Self::to_item(secret);
            let event: SecretEvent = SecretEvent {
                r#type: kind,
                object: item,
            };
            let _ = app_handle.emit(event_name, event);
        }
    }
}
