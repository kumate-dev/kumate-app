use futures_util::future::join_all;
use k8s_openapi::api::batch::v1::{Job, JobSpec, JobStatus};
use kube::{
    api::{ListParams, ObjectList},
    Api, Client, ResourceExt,
};
use serde::Serialize;
use tauri::Emitter;

use crate::{k8s::common::K8sCommon, types::event::EventType};

use super::client::K8sClient;

#[derive(Serialize, Debug, Clone)]
pub struct JobItem {
    pub name: String,
    pub namespace: String,
    pub progress: String,
    pub creation_timestamp: Option<String>,
}

#[derive(Serialize, Clone)]
struct JobEvent {
    r#type: EventType,
    object: JobItem,
}

pub struct K8sJobs;

impl K8sJobs {
    pub async fn list(
        name: String,
        namespaces: Option<Vec<String>>,
    ) -> Result<Vec<JobItem>, String> {
        let client: Client = K8sClient::for_context(&name).await?;
        let target_namespaces: Vec<Option<String>> = K8sCommon::get_target_namespaces(namespaces);

        let all_jobs: Vec<JobItem> = join_all(
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

        Ok(all_jobs)
    }

    pub async fn watch(
        app_handle: tauri::AppHandle,
        name: String,
        namespaces: Option<Vec<String>>,
        event_name: String,
    ) -> Result<(), String> {
        let client: Client = K8sClient::for_context(&name).await?;
        let target_namespaces: Vec<Option<String>> = K8sCommon::get_target_namespaces(namespaces);

        for ns in target_namespaces {
            let api: Api<Job> = K8sClient::api::<Job>(client.clone(), ns).await;

            K8sCommon::event_spawn_watch(
                app_handle.clone(),
                event_name.clone(),
                K8sCommon::watch_stream(&api).await?,
                Self::emit,
            );
        }

        Ok(())
    }

    async fn fetch(client: Client, namespace: Option<String>) -> Result<Vec<Job>, String> {
        let api: Api<Job> = K8sClient::api::<Job>(client, namespace).await;
        let lp: ListParams = ListParams::default();
        let list: ObjectList<Job> = api
            .list(&lp)
            .await
            .map_err(|e: kube::Error| e.to_string())?;
        Ok(list.items)
    }

    fn to_item(j: Job) -> JobItem {
        let completions: i32 = j
            .status
            .as_ref()
            .and_then(|s: &JobStatus| s.succeeded)
            .unwrap_or(0);
        let desired: i32 = j
            .spec
            .as_ref()
            .and_then(|s: &JobSpec| s.completions)
            .unwrap_or(0);
        JobItem {
            name: j.name_any(),
            namespace: K8sCommon::to_namespace(j.namespace()),
            progress: format!("{}/{}", completions, desired),
            creation_timestamp: K8sCommon::to_creation_timestamp(j.metadata),
        }
    }

    fn emit(app_handle: &tauri::AppHandle, event_name: &str, kind: EventType, j: Job) {
        if j.metadata.name.is_some() {
            let item: JobItem = Self::to_item(j);
            let event: JobEvent = JobEvent {
                r#type: kind,
                object: item,
            };
            let _ = app_handle.emit(event_name, event);
        }
    }
}
