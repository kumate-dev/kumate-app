use std::collections::BTreeMap;

use futures_util::future::join_all;
use k8s_openapi::api::core::v1::LimitRange;
use k8s_openapi::apimachinery::pkg::api::resource::Quantity;
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

#[derive(Serialize, Clone)]
struct LimitRangeEvent {
    r#type: EventType,
    object: LimitRangeItem,
}

pub struct K8sLimitRanges;

impl K8sLimitRanges {
    pub async fn list(
        name: String,
        namespaces: Option<Vec<String>>,
    ) -> Result<Vec<LimitRangeItem>, String> {
        let client: Client = K8sClient::for_context(&name).await?;
        let target_namespaces: Vec<Option<String>> = get_target_namespaces(namespaces);

        let all_items: Vec<LimitRangeItem> = join_all(
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

        Ok(all_items)
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
            let api: Api<LimitRange> = K8sClient::api::<LimitRange>(client.clone(), ns).await;

            event_spawn_watch(
                app_handle.clone(),
                event_name.clone(),
                watch_stream(&api).await?,
                Self::emit,
            );
        }

        Ok(())
    }

    async fn fetch(client: Client, namespace: Option<String>) -> Result<Vec<LimitRange>, String> {
        let api: Api<LimitRange> = K8sClient::api::<LimitRange>(client, namespace).await;
        let lp: ListParams = ListParams::default();
        let list: ObjectList<LimitRange> = api.list(&lp).await.map_err(|e| e.to_string())?;
        Ok(list.items)
    }

    fn to_item(lr: LimitRange) -> LimitRangeItem {
        let type_ = lr
            .spec
            .as_ref()
            .and_then(|spec| spec.limits.get(0))
            .map(|l| l.type_.clone())
            .unwrap_or_default();

        let (min, max, default, default_request) = if let Some(ref spec) = lr.spec {
            if let Some(ref l) = spec.limits.get(0) {
                (
                    Self::quantity_map_to_string(&l.min),
                    Self::quantity_map_to_string(&l.max),
                    Self::quantity_map_to_string(&l.default),
                    Self::quantity_map_to_string(&l.default_request),
                )
            } else {
                (None, None, None, None)
            }
        } else {
            (None, None, None, None)
        };

        LimitRangeItem {
            name: lr.name_any(),
            namespace: to_namespace(lr.namespace()),
            type_,
            min,
            max,
            default,
            default_request,
            creation_timestamp: to_creation_timestamp(lr.metadata.clone()),
        }
    }

    fn quantity_map_to_string(
        map: &Option<BTreeMap<String, Quantity>>,
    ) -> Option<BTreeMap<String, String>> {
        map.as_ref().map(|m| {
            m.iter()
                .map(|(k, v)| (k.clone(), v.0.clone())) // Quantity.0 là String
                .collect::<BTreeMap<_, _>>()
        })
    }

    fn emit(app_handle: &tauri::AppHandle, event_name: &str, kind: EventType, lr: LimitRange) {
        if lr.metadata.name.is_some() {
            let item: LimitRangeItem = Self::to_item(lr);
            let event: LimitRangeEvent = LimitRangeEvent {
                r#type: kind,
                object: item,
            };
            let _ = app_handle.emit(event_name, event);
        }
    }
}
