use kube::{Api, Client, ResourceExt};
use serde::Serialize;
use tauri::AppHandle;

use super::client::K8sClient;
use crate::{services::k8s::common::K8sCommon, types::event::EventType};
use k8s_openapi::api::core::v1::Secret;

#[derive(Serialize, Debug, Clone)]
pub struct SecretItem {
    pub name: String,
    pub namespace: String,
    pub type_: String,
    pub data_keys: Vec<String>,
    pub creation_timestamp: Option<String>,
}

impl From<Secret> for SecretItem {
    fn from(secret: Secret) -> Self {
        (&secret).into()
    }
}

impl From<&Secret> for SecretItem {
    fn from(secret: &Secret) -> Self {
        let keys: Vec<String> = secret
            .data
            .as_ref()
            .map(|m| m.keys().cloned().collect())
            .unwrap_or_default();

        SecretItem {
            name: secret.name_any(),
            namespace: K8sCommon::to_namespace(secret.namespace()),
            type_: secret.type_.clone().unwrap_or_default(),
            data_keys: keys,
            creation_timestamp: K8sCommon::to_creation_timestamp(secret.metadata.clone()),
        }
    }
}

pub struct K8sSecrets;

impl K8sSecrets {
    pub async fn list(
        context_name: String,
        namespaces: Option<Vec<String>>,
    ) -> Result<Vec<SecretItem>, String> {
        K8sCommon::list_resources::<Secret, _, SecretItem>(
            &context_name,
            namespaces,
            |client, ns| {
                Box::pin(async move {
                    let api: Api<Secret> = K8sClient::api::<Secret>(client, ns).await;
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
            let api: Api<Secret> = K8sClient::api::<Secret>(client.clone(), ns).await;
            K8sCommon::event_spawn_watch(
                app_handle.clone(),
                event_name.clone(),
                K8sCommon::watch_stream(&api).await?,
                Self::emit_event,
            );
        }

        Ok(())
    }

    fn emit_event(app_handle: &AppHandle, event_name: &str, kind: EventType, secret: Secret) {
        K8sCommon::emit_event::<Secret, SecretItem>(app_handle, event_name, kind, secret);
    }
}
