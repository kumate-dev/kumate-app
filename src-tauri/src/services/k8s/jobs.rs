use kube::{Api, Client, ResourceExt};
use serde::Serialize;
use tauri::AppHandle;

use super::client::K8sClient;
use crate::{services::k8s::common::K8sCommon, types::event::EventType};
use k8s_openapi::api::batch::v1::Job;

#[derive(Serialize, Debug, Clone)]
pub struct JobItem {
    pub name: String,
    pub namespace: String,
    pub progress: String,
    pub creation_timestamp: Option<String>,
}

impl From<Job> for JobItem {
    fn from(j: Job) -> Self {
        (&j).into()
    }
}

impl From<&Job> for JobItem {
    fn from(j: &Job) -> Self {
        let completions = j.status.as_ref().and_then(|s| s.succeeded).unwrap_or(0);
        let desired = j.spec.as_ref().and_then(|s| s.completions).unwrap_or(0);
        Self {
            name: j.name_any(),
            namespace: K8sCommon::to_namespace(j.namespace()),
            progress: format!("{}/{}", completions, desired),
            creation_timestamp: K8sCommon::to_creation_timestamp(j.metadata.clone()),
        }
    }
}

pub struct K8sJobs;

impl K8sJobs {
    pub async fn list(
        context_name: String,
        namespaces: Option<Vec<String>>,
    ) -> Result<Vec<JobItem>, String> {
        K8sCommon::list_resources::<Job, _, JobItem>(&context_name, namespaces, |client, ns| {
            Box::pin(async move {
                let api: Api<Job> = K8sClient::api::<Job>(client, ns).await;
                let list = api
                    .list(&Default::default())
                    .await
                    .map_err(|e| e.to_string())?;
                Ok(list.items)
            })
        })
        .await
    }

    pub async fn watch(
        app_handle: AppHandle,
        context_name: String,
        namespaces: Option<Vec<String>>,
        event_name: String,
    ) -> Result<(), String> {
        let client: Client = K8sClient::for_context(&context_name).await?;
        let target_namespaces = K8sCommon::get_target_namespaces(namespaces);

        for ns in target_namespaces {
            let api: Api<Job> = K8sClient::api::<Job>(client.clone(), ns).await;
            K8sCommon::event_spawn_watch(
                app_handle.clone(),
                event_name.clone(),
                K8sCommon::watch_stream(&api).await?,
                Self::emit_event,
            );
        }

        Ok(())
    }

    fn emit_event(app_handle: &AppHandle, event_name: &str, kind: EventType, j: Job) {
        K8sCommon::emit_event::<Job, JobItem>(app_handle, event_name, kind, j);
    }
}
