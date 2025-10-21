use futures_util::future::join_all;
use k8s_openapi::api::batch::v1::{CronJob, CronJobSpec, CronJobStatus};
use k8s_openapi::apimachinery::pkg::apis::meta::v1::Time;
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
    pub async fn list(
        name: String,
        namespaces: Option<Vec<String>>,
    ) -> Result<Vec<CronJobItem>, String> {
        let client: Client = K8sClient::for_context(&name).await?;
        let target_namespaces: Vec<String> = get_target_namespaces(namespaces);

        let all_cronjobs: Vec<CronJobItem> = if target_namespaces.is_empty() {
            Self::fetch(client.clone(), None)
                .await?
                .into_iter()
                .map(Self::to_item)
                .collect()
        } else {
            let results: Vec<Vec<CronJob>> = join_all(
                target_namespaces
                    .into_iter()
                    .map(|ns| Self::fetch(client.clone(), Some(ns))),
            )
            .await
            .into_iter()
            .collect::<Result<Vec<_>, _>>()?;
            results.into_iter().flatten().map(Self::to_item).collect()
        };

        Ok(all_cronjobs)
    }

    pub async fn watch(
        app_handle: AppHandle,
        name: String,
        namespaces: Option<Vec<String>>,
        event_name: String,
    ) -> Result<(), String> {
        let client: Client = K8sClient::for_context(&name).await?;
        let target_namespaces: Vec<String> = namespaces.unwrap_or_else(|| vec![String::from("")]);

        for ns in target_namespaces {
            let api: Api<CronJob> = K8sClient::api::<CronJob>(
                client.clone(),
                if ns.is_empty() {
                    None
                } else {
                    Some(ns.clone())
                },
            )
            .await;

            event_spawn_watch(
                app_handle.clone(),
                event_name.clone(),
                watch_stream(&api).await?,
                Self::emit,
            );
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
