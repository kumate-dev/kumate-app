use std::pin::Pin;

use futures_util::{Stream, StreamExt};
use k8s_openapi::api::batch::v1::{CronJob, CronJobSpec, CronJobStatus};
use k8s_openapi::apimachinery::pkg::apis::meta::v1::Time;
use kube::api::{ListParams, ObjectList, WatchEvent, WatchParams};
use kube::{Api, Client, ResourceExt};
use serde::Serialize;
use tauri::Emitter;

use crate::types::event::EventType;
use crate::utils::k8s::{to_creation_timestamp, to_namespace};

use super::client::K8sClient;

#[derive(Serialize, Debug, Clone)]
pub struct CronJobItem {
    pub name: String,
    pub namespace: String,
    pub schedule: String,
    pub suspend: bool,
    pub last_schedule: Option<String>,
    pub creation_timestamp: Option<String>,
}

#[derive(Serialize, Clone)]
struct CronJobEvent {
    r#type: EventType,
    object: CronJobItem,
}

pub struct K8sCronJobs;

impl K8sCronJobs {
    pub async fn list(name: String, namespace: Option<String>) -> Result<Vec<CronJobItem>, String> {
        let client: Client = K8sClient::for_context(&name).await?;
        let cronjobs: Vec<CronJob> = Self::fetch(client, namespace).await?;
        let mut out: Vec<CronJobItem> = cronjobs.into_iter().map(Self::to_item).collect();
        out.sort_by(|a: &CronJobItem, b: &CronJobItem| a.name.cmp(&b.name));
        Ok(out)
    }

    pub async fn watch(
        app_handle: tauri::AppHandle,
        name: String,
        namespace: Option<String>,
        event_name: String,
    ) -> Result<(), String> {
        let client: Client = K8sClient::for_context(&name).await?;
        let api: Api<CronJob> = K8sClient::api::<CronJob>(client, namespace).await;

        let mut stream: Pin<
            Box<dyn Stream<Item = Result<WatchEvent<CronJob>, kube::Error>> + Send>,
        > = api
            .watch(&WatchParams::default(), "0")
            .await
            .map_err(|e| e.to_string())?
            .boxed();

        while let Some(status) = stream.next().await {
            match status {
                Ok(WatchEvent::Added(cj)) => {
                    Self::emit(&app_handle, &event_name, EventType::ADDED, cj)
                }
                Ok(WatchEvent::Modified(cj)) => {
                    Self::emit(&app_handle, &event_name, EventType::MODIFIED, cj)
                }
                Ok(WatchEvent::Deleted(cj)) => {
                    Self::emit(&app_handle, &event_name, EventType::DELETED, cj)
                }
                Err(e) => eprintln!("CronJob watch error: {}", e),
                _ => {}
            }
        }
        Ok(())
    }

    async fn fetch(client: Client, namespace: Option<String>) -> Result<Vec<CronJob>, String> {
        let api: Api<CronJob> = K8sClient::api::<CronJob>(client, namespace).await;
        let lp: ListParams = ListParams::default();
        let list: ObjectList<CronJob> = api.list(&lp).await.map_err(|e| e.to_string())?;
        Ok(list.items)
    }

    fn to_item(cj: CronJob) -> CronJobItem {
        let schedule: String = cj
            .spec
            .as_ref()
            .map(|s: &CronJobSpec| s.schedule.clone())
            .unwrap_or_default();
        let suspend: bool = cj
            .spec
            .as_ref()
            .and_then(|s: &CronJobSpec| s.suspend)
            .unwrap_or(false);
        let last: Option<String> = cj
            .status
            .as_ref()
            .and_then(|st: &CronJobStatus| st.last_schedule_time.as_ref())
            .map(|t: &Time| t.0.to_rfc3339());
        CronJobItem {
            name: cj.name_any(),
            namespace: to_namespace(cj.namespace()),
            schedule: schedule,
            suspend: suspend,
            last_schedule: last,
            creation_timestamp: to_creation_timestamp(cj.metadata.clone()),
        }
    }

    fn emit(app_handle: &tauri::AppHandle, event_name: &str, kind: EventType, cj: CronJob) {
        if cj.metadata.name.is_some() {
            let item: CronJobItem = Self::to_item(cj);
            let event: CronJobEvent = CronJobEvent {
                r#type: kind,
                object: item,
            };
            let _ = app_handle.emit(event_name, event);
        }
    }
}
