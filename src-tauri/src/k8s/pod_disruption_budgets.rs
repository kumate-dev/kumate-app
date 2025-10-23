use kube::{api::ObjectList, Api, Client, ResourceExt};
use serde::Serialize;
use tauri::AppHandle;

use super::client::K8sClient;
use crate::utils::converts::int_or_string_to_string;
use crate::{k8s::common::K8sCommon, types::event::EventType};
use k8s_openapi::api::policy::v1::{PodDisruptionBudget, PodDisruptionBudgetStatus};

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

impl From<PodDisruptionBudget> for PodDisruptionBudgetItem {
    fn from(pdb: PodDisruptionBudget) -> Self {
        (&pdb).into()
    }
}

impl From<&PodDisruptionBudget> for PodDisruptionBudgetItem {
    fn from(pdb: &PodDisruptionBudget) -> Self {
        let spec = pdb.spec.as_ref();
        let status = pdb.status.as_ref();

        Self {
            name: pdb.name_any(),
            namespace: K8sCommon::to_namespace(pdb.namespace()),
            min_available: spec.and_then(|s| int_or_string_to_string(&s.min_available)),
            max_unavailable: spec.and_then(|s| int_or_string_to_string(&s.max_unavailable)),
            current_healthy: status.map_or(0, |s| s.current_healthy),
            desired_healthy: status.map_or(0, |s| s.desired_healthy),
            disruptions_allowed: status.map_or(0, |s| s.disruptions_allowed),
            status: K8sPodDisruptionBudgets::extract_status(status),
            creation_timestamp: K8sCommon::to_creation_timestamp(pdb.metadata.clone()),
        }
    }
}

pub struct K8sPodDisruptionBudgets;

impl K8sPodDisruptionBudgets {
    pub async fn list(
        context_name: String,
        namespaces: Option<Vec<String>>,
    ) -> Result<Vec<PodDisruptionBudgetItem>, String> {
        K8sCommon::list_resources::<PodDisruptionBudget, _, PodDisruptionBudgetItem>(
            &context_name,
            namespaces,
            |client, ns| {
                Box::pin(async move {
                    let api: Api<PodDisruptionBudget> =
                        K8sClient::api::<PodDisruptionBudget>(client, ns).await;
                    let list: ObjectList<PodDisruptionBudget> = api
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
            let api: Api<PodDisruptionBudget> =
                K8sClient::api::<PodDisruptionBudget>(client.clone(), ns).await;
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
        pdb: PodDisruptionBudget,
    ) {
        K8sCommon::emit_event::<PodDisruptionBudget, PodDisruptionBudgetItem>(
            app_handle, event_name, kind, pdb,
        );
    }

    fn extract_status(status: Option<&PodDisruptionBudgetStatus>) -> String {
        match status {
            Some(st) if st.disruptions_allowed > 0 => "Healthy".to_string(),
            Some(st) if st.current_healthy < st.desired_healthy => "Degraded".to_string(),
            Some(_) => "Blocked".to_string(),
            None => "Unknown".to_string(),
        }
    }
}
