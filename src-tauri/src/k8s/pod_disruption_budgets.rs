use futures_util::future::join_all;
use k8s_openapi::api::policy::v1::{
    PodDisruptionBudget, PodDisruptionBudgetSpec, PodDisruptionBudgetStatus,
};
use kube::api::{ListParams, ObjectList};
use kube::{Api, Client, ResourceExt};
use serde::Serialize;
use tauri::{AppHandle, Emitter};

use super::client::K8sClient;
use crate::types::event::EventType;
use crate::utils::converts::int_or_string_to_string;
use crate::utils::k8s::{
    event_spawn_watch, get_target_namespaces, to_creation_timestamp, to_namespace, watch_stream,
};

#[derive(Serialize, Debug, Clone)]
pub struct PodDisruptionBudgetItem {
    pub name: String,
    pub namespace: String,
    pub min_available: Option<String>,
    pub max_unavailable: Option<String>,
    pub current_healthy: i32,
    pub desired_healthy: i32,
    pub disruptions_allowed: i32,
    pub status: String,
    pub creation_timestamp: Option<String>,
}

#[derive(Serialize, Clone)]
struct PodDisruptionBudgetEvent {
    r#type: EventType,
    object: PodDisruptionBudgetItem,
}

pub struct K8sPodDisruptionBudgets;

impl K8sPodDisruptionBudgets {
    pub async fn list(
        name: String,
        namespaces: Option<Vec<String>>,
    ) -> Result<Vec<PodDisruptionBudgetItem>, String> {
        let client: Client = K8sClient::for_context(&name).await?;
        let target_namespaces: Vec<Option<String>> = get_target_namespaces(namespaces);

        let all_pdbs: Vec<PodDisruptionBudgetItem> = join_all(
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

        Ok(all_pdbs)
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
            let api: Api<PodDisruptionBudget> =
                K8sClient::api::<PodDisruptionBudget>(client.clone(), ns).await;

            event_spawn_watch(
                app_handle.clone(),
                event_name.clone(),
                watch_stream(&api).await?,
                Self::emit,
            );
        }

        Ok(())
    }

    async fn fetch(
        client: Client,
        namespace: Option<String>,
    ) -> Result<Vec<PodDisruptionBudget>, String> {
        let api: Api<PodDisruptionBudget> =
            K8sClient::api::<PodDisruptionBudget>(client, namespace).await;
        let lp = ListParams::default();
        let list: ObjectList<PodDisruptionBudget> =
            api.list(&lp).await.map_err(|e| e.to_string())?;
        Ok(list.items)
    }

    fn to_item(pdb: PodDisruptionBudget) -> PodDisruptionBudgetItem {
        let spec: Option<&PodDisruptionBudgetSpec> = pdb.spec.as_ref();
        let status: Option<&PodDisruptionBudgetStatus> = pdb.status.as_ref();

        PodDisruptionBudgetItem {
            name: pdb.name_any(),
            namespace: to_namespace(pdb.namespace()),
            min_available: spec
                .as_ref()
                .and_then(|s| int_or_string_to_string(&s.min_available)),
            max_unavailable: spec
                .as_ref()
                .and_then(|s| int_or_string_to_string(&s.max_unavailable)),
            current_healthy: status.as_ref().map_or(0, |s| s.current_healthy),
            desired_healthy: status.as_ref().map_or(0, |s| s.desired_healthy),
            disruptions_allowed: status.as_ref().map_or(0, |s| s.disruptions_allowed),
            status: Self::extract_status(status),
            creation_timestamp: to_creation_timestamp(pdb.metadata.clone()),
        }
    }

    fn extract_status(status: Option<&PodDisruptionBudgetStatus>) -> String {
        if let Some(st) = status {
            if st.disruptions_allowed > 0 {
                "Healthy".to_string()
            } else if st.current_healthy < st.desired_healthy {
                "Degraded".to_string()
            } else {
                "Blocked".to_string()
            }
        } else {
            "Unknown".to_string()
        }
    }

    fn emit(
        app_handle: &tauri::AppHandle,
        event_name: &str,
        kind: EventType,
        pdb: PodDisruptionBudget,
    ) {
        if pdb.metadata.name.is_some() {
            let item = Self::to_item(pdb);
            let event = PodDisruptionBudgetEvent {
                r#type: kind,
                object: item,
            };
            let _ = app_handle.emit(event_name, event);
        }
    }
}
