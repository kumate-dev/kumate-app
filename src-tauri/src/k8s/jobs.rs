use futures_util::{Stream, StreamExt};
use k8s_openapi::api::batch::v1::{Job, JobSpec, JobStatus};
use kube::{
    api::{ListParams, ObjectList, WatchEvent, WatchParams},
    Api, Client, ResourceExt,
};
use serde::Serialize;
use std::pin::Pin;
use tauri::Emitter;

use crate::types::event::EventType;
use crate::utils::k8s::{to_creation_timestamp, to_namespace};

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
    pub async fn list(name: String, namespace: Option<String>) -> Result<Vec<JobItem>, String> {
        let client: Client = K8sClient::for_context(&name).await?;
        let jobs: Vec<Job> = Self::fetch(client, namespace).await?;
        let mut out: Vec<JobItem> = jobs.into_iter().map(Self::to_item).collect();
        out.sort_by(|a: &JobItem, b: &JobItem| a.name.cmp(&b.name));
        Ok(out)
    }

    pub async fn watch(
        app_handle: tauri::AppHandle,
        name: String,
        namespace: Option<String>,
        event_name: String,
    ) -> Result<(), String> {
        let client: Client = K8sClient::for_context(&name).await?;
        let api: Api<Job> = K8sClient::api::<Job>(client, namespace).await;

        let mut stream: Pin<Box<dyn Stream<Item = Result<WatchEvent<Job>, kube::Error>> + Send>> =
            api.watch(&WatchParams::default(), "0")
                .await
                .map_err(|e| e.to_string())?
                .boxed();

        while let Some(status) = stream.next().await {
            match status {
                Ok(WatchEvent::Added(dep)) => {
                    Self::emit(&app_handle, &event_name, EventType::ADDED, dep)
                }
                Ok(WatchEvent::Modified(dep)) => {
                    Self::emit(&app_handle, &event_name, EventType::MODIFIED, dep)
                }
                Ok(WatchEvent::Deleted(dep)) => {
                    Self::emit(&app_handle, &event_name, EventType::DELETED, dep)
                }
                Err(e) => eprintln!("Job watch error: {}", e),
                _ => {}
            }
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
            namespace: to_namespace(j.namespace()),
            progress: format!("{}/{}", completions, desired),
            creation_timestamp: to_creation_timestamp(j.metadata),
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
