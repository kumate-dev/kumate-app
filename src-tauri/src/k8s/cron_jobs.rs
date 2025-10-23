use k8s_openapi::api::batch::v1::CronJob;
use kube::{Api, Client, ResourceExt};
use serde::Serialize;
use tauri::AppHandle;

use crate::k8s::common::K8sCommon;
use crate::types::event::EventType;

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

impl From<CronJob> for CronJobItem {
    fn from(cj: CronJob) -> Self {
        (&cj).into()
    }
}

impl From<&CronJob> for CronJobItem {
    fn from(cj: &CronJob) -> Self {
        Self {
            name: cj.name_any(),
            namespace: K8sCommon::to_namespace(cj.namespace()),
            schedule: cj
                .spec
                .as_ref()
                .map(|s| s.schedule.clone())
                .unwrap_or_default(),
            suspend: cj.spec.as_ref().and_then(|s| s.suspend).unwrap_or(false),
            last_schedule: cj
                .status
                .as_ref()
                .and_then(|st| st.last_schedule_time.as_ref())
                .map(|t| t.0.to_rfc3339()),
            creation_timestamp: K8sCommon::to_creation_timestamp(cj.metadata.clone()),
        }
    }
}

pub struct K8sCronJobs;

impl K8sCronJobs {
    pub async fn list(
        name: String,
        namespaces: Option<Vec<String>>,
    ) -> Result<Vec<CronJobItem>, String> {
        K8sCommon::list_resources::<CronJob, _, CronJobItem>(&name, namespaces, |client, ns| {
            Box::pin(async move {
                let api: Api<CronJob> = K8sClient::api::<CronJob>(client, ns).await;
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
        let target_namespaces: Vec<Option<String>> = K8sCommon::get_target_namespaces(namespaces);

        for ns in target_namespaces {
            let api: Api<CronJob> = K8sClient::api::<CronJob>(client.clone(), ns).await;
            K8sCommon::event_spawn_watch(
                app_handle.clone(),
                event_name.clone(),
                K8sCommon::watch_stream(&api).await?,
                Self::emit_event,
            );
        }

        Ok(())
    }

    fn emit_event(app_handle: &AppHandle, event_name: &str, kind: EventType, cj: CronJob) {
        K8sCommon::emit_event::<CronJob, CronJobItem>(app_handle, event_name, kind, cj);
    }
}
