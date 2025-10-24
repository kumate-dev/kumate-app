use k8s_openapi::api::core::v1::{Container, Pod, PodSpec, PodStatus};
use kube::{Api, Client, ResourceExt};
use serde::Serialize;

use super::client::K8sClient;
use crate::{k8s::common::K8sCommon, types::event::EventType, utils::bytes::Bytes};

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

impl From<Pod> for PodItem {
    fn from(p: Pod) -> Self {
        (&p).into()
    }
}

impl From<&Pod> for PodItem {
    fn from(p: &Pod) -> Self {
        Self {
            name: p.name_any(),
            namespace: K8sCommon::to_namespace(p.namespace()),
            phase: p.status.as_ref().and_then(|s| s.phase.clone()),
            creation_timestamp: K8sCommon::to_creation_timestamp(p.metadata.clone()),
            containers: p.spec.as_ref().map(|s| s.containers.len()).unwrap_or(0),
            container_states: K8sPods::extract_container_states(p.status.clone()),
            cpu: K8sPods::aggregate_cpu(p.spec.clone()),
            memory: K8sPods::aggregate_memory(p.spec.clone()),
            restart: K8sPods::sum_restarts(p.status.clone()),
            node: p.spec.as_ref().and_then(|s| s.node_name.clone()),
            qos: p.status.as_ref().and_then(|s| s.qos_class.clone()),
        }
    }
}

pub struct K8sPods;

impl K8sPods {
    pub async fn list(
        name: String,
        namespaces: Option<Vec<String>>,
    ) -> Result<Vec<PodItem>, String> {
        K8sCommon::list_resources::<Pod, _, PodItem>(&name, namespaces, |client, namespace| {
            Box::pin(async move {
                let api: Api<Pod> = K8sClient::api::<Pod>(client, namespace).await;
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
        app_handle: tauri::AppHandle,
        context_name: String,
        namespaces: Option<Vec<String>>,
        event_name: String,
    ) -> Result<(), String> {
        let client: Client = K8sClient::for_context(&context_name).await?;
        let target_namespaces: Vec<Option<String>> = K8sCommon::get_target_namespaces(namespaces);

        for ns in target_namespaces {
            let api: Api<Pod> = K8sClient::api::<Pod>(client.clone(), ns).await;
            K8sCommon::event_spawn_watch(
                app_handle.clone(),
                event_name.clone(),
                K8sCommon::watch_stream(&api).await?,
                Self::emit_event,
            );
        }

        Ok(())
    }

    pub async fn delete(
        name: String,
        namespace: Option<String>,
        pod_names: Vec<String>,
    ) -> Result<Vec<Result<String, String>>, String> {
        K8sCommon::delete_resources::<Pod, _, _>(
            &name,
            namespace,
            pod_names,
            |client: kube::Client, ns: Option<String>| Box::pin(K8sClient::api::<Pod>(client, ns)),
        )
        .await
    }

    fn emit_event(app_handle: &tauri::AppHandle, event_name: &str, kind: EventType, p: Pod) {
        K8sCommon::emit_event::<Pod, PodItem>(app_handle, event_name, kind, p);
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
            s.parse::<f64>().ok().map(|cores| cores * 1000.0)
        }
    }
}
