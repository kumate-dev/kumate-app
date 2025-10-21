use futures_util::future::join_all;
use k8s_openapi::api::core::v1::{Container, Pod, PodSpec, PodStatus};
use kube::{
    api::{ListParams, ObjectList},
    Api, Client, ResourceExt,
};
use serde::Serialize;
use tauri::Emitter;

use super::client::K8sClient;
use crate::{
    types::event::EventType,
    utils::{
        bytes::Bytes,
        k8s::{
            event_spawn_watch, get_target_namespaces, to_creation_timestamp, to_namespace,
            watch_stream,
        },
    },
};

#[derive(Serialize, Debug, Clone)]
pub struct PodItem {
    pub name: String,
    pub namespace: String,
    pub phase: Option<String>,
    pub creation_timestamp: Option<String>,
    pub containers: usize,
    pub container_states: Option<Vec<String>>,
    pub cpu: Option<String>,
    pub memory: Option<String>,
    pub restart: Option<i32>,
    pub node: Option<String>,
    pub qos: Option<String>,
}

#[derive(Serialize, Clone)]
struct PodEvent {
    r#type: EventType,
    object: PodItem,
}

pub struct K8sPods;

impl K8sPods {
    pub async fn list(
        name: String,
        namespaces: Option<Vec<String>>,
    ) -> Result<Vec<PodItem>, String> {
        let client: Client = K8sClient::for_context(&name).await?;
        let target_namespaces: Vec<String> = get_target_namespaces(namespaces);

        let all_pods: Vec<PodItem> = if target_namespaces.is_empty() {
            Self::fetch(client.clone(), None)
                .await?
                .into_iter()
                .map(Self::to_item)
                .collect()
        } else {
            let results: Vec<Vec<Pod>> = join_all(
                target_namespaces
                    .into_iter()
                    .map(|ns| Self::fetch(client.clone(), Some(ns))),
            )
            .await
            .into_iter()
            .collect::<Result<Vec<_>, _>>()?;
            results.into_iter().flatten().map(Self::to_item).collect()
        };

        Ok(all_pods)
    }

    pub async fn watch(
        app_handle: tauri::AppHandle,
        name: String,
        namespaces: Option<Vec<String>>,
        event_name: String,
    ) -> Result<(), String> {
        let client: Client = K8sClient::for_context(&name).await?;
        let target_namespaces: Vec<String> = namespaces.unwrap_or_else(|| vec![String::from("")]);

        for ns in target_namespaces {
            let api: Api<Pod> = K8sClient::api::<Pod>(client.clone(), Some(ns.clone())).await;
            event_spawn_watch(
                app_handle.clone(),
                event_name.clone(),
                watch_stream(&api).await?,
                Self::emit,
            );
        }
        Ok(())
    }

    async fn fetch(client: Client, namespace: Option<String>) -> Result<Vec<Pod>, String> {
        let api: Api<Pod> = K8sClient::api::<Pod>(client, namespace).await;
        let lp: ListParams = ListParams::default();
        let list: ObjectList<Pod> = api
            .list(&lp)
            .await
            .map_err(|e: kube::Error| e.to_string())?;
        Ok(list.items)
    }

    pub fn to_item(p: Pod) -> PodItem {
        PodItem {
            name: p.name_any(),
            namespace: to_namespace(p.namespace()),
            phase: p.status.as_ref().and_then(|s: &PodStatus| s.phase.clone()),
            creation_timestamp: to_creation_timestamp(p.metadata.clone()),
            containers: p
                .spec
                .as_ref()
                .map(|s: &PodSpec| s.containers.len())
                .unwrap_or(0),
            container_states: Self::extract_container_states(p.status.clone()),
            cpu: Self::aggregate_cpu(p.spec.clone()),
            memory: Self::aggregate_memory(p.spec.clone()),
            restart: Self::sum_restarts(p.status.clone()),
            node: p.spec.as_ref().and_then(|s: &PodSpec| s.node_name.clone()),
            qos: p
                .status
                .as_ref()
                .and_then(|s: &PodStatus| s.qos_class.clone()),
        }
    }

    fn emit(app_handle: &tauri::AppHandle, event_name: &str, kind: EventType, p: Pod) {
        if p.metadata.name.is_some() {
            let item: PodItem = Self::to_item(p);
            let event: PodEvent = PodEvent {
                r#type: kind,
                object: item,
            };
            let _ = app_handle.emit(event_name, event);
        }
    }

    fn extract_container_states(status: Option<PodStatus>) -> Option<Vec<String>> {
        status.as_ref()?.container_statuses.as_ref().map(|css| {
            css.iter()
                .map(|cs| {
                    if let Some(state) = &cs.state {
                        if let Some(waiting) = &state.waiting {
                            return waiting
                                .reason
                                .clone()
                                .unwrap_or_else(|| "Waiting".to_string());
                        } else if let Some(terminated) = &state.terminated {
                            return terminated
                                .reason
                                .clone()
                                .unwrap_or_else(|| "Terminated".to_string());
                        } else if state.running.is_some() {
                            return "Running".to_string();
                        }
                    }
                    "Unknown".to_string()
                })
                .collect::<Vec<_>>()
        })
    }

    fn sum_restarts(status: Option<PodStatus>) -> Option<i32> {
        let mut total: i32 = 0;
        let mut has_any: bool = false;
        if let Some(st) = status.as_ref() {
            if let Some(css) = st.container_statuses.as_ref() {
                for cs in css.iter() {
                    total += cs.restart_count;
                    has_any = true;
                }
            }
            if let Some(ics) = st.init_container_statuses.as_ref() {
                for cs in ics.iter() {
                    total += cs.restart_count;
                    has_any = true;
                }
            }
        }
        if has_any {
            Some(total)
        } else {
            None
        }
    }

    fn aggregate_cpu(spec: Option<PodSpec>) -> Option<String> {
        let containers: &Vec<Container> = match spec.as_ref() {
            Some(sp) => &sp.containers,
            None => return None,
        };
        let mut req_m: f64 = 0.0;
        let mut lim_m: f64 = 0.0;
        let mut has_req: bool = false;
        let mut has_lim: bool = false;
        for c in containers.iter() {
            if let Some(res) = c.resources.as_ref() {
                if let Some(reqs) = res.requests.as_ref() {
                    if let Some(q) = reqs.get("cpu") {
                        if let Some(v) = Self::cpu_qty_to_m(&q.0) {
                            req_m += v;
                            has_req = true;
                        }
                    }
                }
                if let Some(lims) = res.limits.as_ref() {
                    if let Some(q) = lims.get("cpu") {
                        if let Some(v) = Self::cpu_qty_to_m(&q.0) {
                            lim_m += v;
                            has_lim = true;
                        }
                    }
                }
            }
        }
        if !has_req && !has_lim {
            return None;
        }
        let req_str: String = if has_req {
            format!("{:.0}m", req_m)
        } else {
            "-".to_string()
        };
        let lim_str: String = if has_lim {
            format!("{:.0}m", lim_m)
        } else {
            "-".to_string()
        };
        if has_req && has_lim {
            Some(format!("{}/{}", req_str, lim_str))
        } else {
            Some(req_str)
        }
    }

    fn aggregate_memory(spec: Option<PodSpec>) -> Option<String> {
        let containers: &Vec<Container> = match spec.as_ref() {
            Some(sp) => &sp.containers,
            None => return None,
        };
        let mut req_b: f64 = 0.0;
        let mut lim_b: f64 = 0.0;
        let mut has_req: bool = false;
        let mut has_lim: bool = false;
        for c in containers.iter() {
            if let Some(res) = c.resources.as_ref() {
                if let Some(reqs) = res.requests.as_ref() {
                    if let Some(q) = reqs.get("memory") {
                        if let Some(v) = Bytes::qty_to_bytes(&q.0) {
                            req_b += v;
                            has_req = true;
                        }
                    }
                }
                if let Some(lims) = res.limits.as_ref() {
                    if let Some(q) = lims.get("memory") {
                        if let Some(v) = Bytes::qty_to_bytes(&q.0) {
                            lim_b += v;
                            has_lim = true;
                        }
                    }
                }
            }
        }
        if !has_req && !has_lim {
            return None;
        }
        let req_str: String = if has_req {
            Bytes::format_bytes_decimal(req_b)
        } else {
            "-".to_string()
        };
        let lim_str: String = if has_lim {
            Bytes::format_bytes_decimal(lim_b)
        } else {
            "-".to_string()
        };
        if has_req && has_lim {
            Some(format!("{}/{}", req_str, lim_str))
        } else {
            Some(req_str)
        }
    }

    fn cpu_qty_to_m(s: &str) -> Option<f64> {
        let s: &str = s.trim();
        if s.is_empty() {
            return None;
        }
        if s.ends_with('m') {
            let num: &str = &s[..s.len() - 1];
            num.parse::<f64>().ok()
        } else if s.ends_with('n') {
            let num: &str = &s[..s.len() - 1];
            num.parse::<f64>().ok().map(|n| n / 1_000_000.0)
        } else if s.ends_with('u') {
            let num: &str = &s[..s.len() - 1];
            num.parse::<f64>().ok().map(|u| u / 1000.0)
        } else {
            // assume cores, convert to milli-cores
            s.parse::<f64>().ok().map(|cores| cores * 1000.0)
        }
    }
}
