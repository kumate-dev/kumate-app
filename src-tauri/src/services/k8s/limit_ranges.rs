use std::collections::BTreeMap;

use kube::{Api, Client, ResourceExt};
use serde::Serialize;
use tauri::AppHandle;

use super::client::K8sClient;
use crate::{services::k8s::common::K8sCommon, types::event::EventType};
use k8s_openapi::api::core::v1::LimitRange;
use k8s_openapi::apimachinery::pkg::api::resource::Quantity;

#[derive(Serialize, Debug, Clone)]
pub struct LimitRangeItem {
    pub name: String,
    pub namespace: String,
    pub type_: String,
    pub min: Option<BTreeMap<String, String>>,
    pub max: Option<BTreeMap<String, String>>,
    pub default: Option<BTreeMap<String, String>>,
    pub default_request: Option<BTreeMap<String, String>>,
    pub creation_timestamp: Option<String>,
}

impl From<LimitRange> for LimitRangeItem {
    fn from(lr: LimitRange) -> Self {
        (&lr).into()
    }
}

impl From<&LimitRange> for LimitRangeItem {
    fn from(lr: &LimitRange) -> Self {
        let type_: String = lr
            .spec
            .as_ref()
            .and_then(|spec| spec.limits.get(0))
            .map(|l| l.type_.clone())
            .unwrap_or_default();

        let (min, max, default, default_request) = if let Some(ref spec) = lr.spec {
            if let Some(ref l) = spec.limits.get(0) {
                (
                    K8sLimitRanges::quantity_map_to_string(&l.min),
                    K8sLimitRanges::quantity_map_to_string(&l.max),
                    K8sLimitRanges::quantity_map_to_string(&l.default),
                    K8sLimitRanges::quantity_map_to_string(&l.default_request),
                )
            } else {
                (None, None, None, None)
            }
        } else {
            (None, None, None, None)
        };

        LimitRangeItem {
            name: lr.name_any(),
            namespace: K8sCommon::to_namespace(lr.namespace()),
            type_,
            min,
            max,
            default,
            default_request,
            creation_timestamp: K8sCommon::to_creation_timestamp(lr.metadata.clone()),
        }
    }
}

pub struct K8sLimitRanges;

impl K8sLimitRanges {
    pub async fn list(
        context_name: String,
        namespaces: Option<Vec<String>>,
    ) -> Result<Vec<LimitRangeItem>, String> {
        K8sCommon::list_resources::<LimitRange, _, LimitRangeItem>(
            &context_name,
            namespaces,
            |client, ns| {
                Box::pin(async move {
                    let api: Api<LimitRange> = K8sClient::api::<LimitRange>(client, ns).await;
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
            let api: Api<LimitRange> = K8sClient::api::<LimitRange>(client.clone(), ns).await;
            K8sCommon::event_spawn_watch(
                app_handle.clone(),
                event_name.clone(),
                K8sCommon::watch_stream(&api).await?,
                Self::emit_event,
            );
        }

        Ok(())
    }

    fn emit_event(app_handle: &AppHandle, event_name: &str, kind: EventType, lr: LimitRange) {
        K8sCommon::emit_event::<LimitRange, LimitRangeItem>(app_handle, event_name, kind, lr);
    }

    fn quantity_map_to_string(
        map: &Option<BTreeMap<String, Quantity>>,
    ) -> Option<BTreeMap<String, String>> {
        map.as_ref().map(|m| {
            m.iter()
                .map(|(k, v)| (k.clone(), v.0.clone()))
                .collect::<BTreeMap<_, _>>()
        })
    }
}
