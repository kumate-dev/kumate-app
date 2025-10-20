use k8s_openapi::api::core::v1::{Container, ContainerStatus, Pod, PodSpec, PodStatus};
use kube::{Api, ResourceExt, Client};
use kube::api::{ListParams, ObjectList};
use serde::Serialize;

use super::client::K8sClient;
use crate::utils::bytes::Bytes;

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

pub struct K8sPods;

impl K8sPods {
    pub async fn list(name: String, namespace: Option<String>) -> Result<Vec<PodItem>, String> {
        let client: Client = K8sClient::for_context(&name).await?;
        let pods: Vec<Pod> = Self::fetch(client, namespace).await?;
        let mut out: Vec<PodItem> = pods.into_iter().map(Self::to_item).collect();
        out.sort_by(|a: &PodItem, b: &PodItem| a.name.cmp(&b.name));
        Ok(out)
    }

    async fn fetch(client: Client, namespace: Option<String>) -> Result<Vec<Pod>, String> {
        let api: Api<Pod> = K8sClient::api::<Pod>(client, namespace).await;
        let lp: ListParams = ListParams::default();
        let list: ObjectList<Pod> = api.list(&lp).await.map_err(|e: kube::Error| e.to_string())?;
        Ok(list.items)
    }

    pub fn to_item(p: Pod) -> PodItem {
        let name: String = p.name_any();
        let namespace: String = p.namespace().unwrap_or_else(|| "default".to_string());
        let phase: Option<String> = p.status.as_ref().and_then(|s: &PodStatus| s.phase.clone());
        let creation_timestamp: Option<String> = p.metadata.creation_timestamp.as_ref().map(|t| t.0.to_rfc3339());
        let containers: usize = Self::count_containers(&p);
        let container_states: Option<Vec<String>> = Self::extract_container_states(&p);
        let cpu: Option<String> = Self::aggregate_cpu(&p);
        let memory: Option<String> = Self::aggregate_memory(&p);
        let restart: Option<i32> = Self::sum_restarts(&p);
        let node: Option<String> = p.spec.as_ref().and_then(|s: &PodSpec| s.node_name.clone());
        let qos: Option<String> = p.status.as_ref().and_then(|s: &PodStatus| s.qos_class.clone());

        PodItem { name, namespace, phase, creation_timestamp, containers, container_states, cpu, memory, restart, node, qos }
    }

    // --- helpers ---

    fn count_containers(p: &Pod) -> usize {
        p.spec.as_ref().map(|s: &PodSpec| s.containers.len()).unwrap_or(0)
    }

    fn extract_container_states(p: &Pod) -> Option<Vec<String>> {
        p.status.as_ref().and_then(|st: &PodStatus| st.container_statuses.as_ref()).map(|css: &Vec<ContainerStatus>| {
            css.iter()
                .map(|cs: &ContainerStatus| {
                    if let Some(state) = cs.state.as_ref() {
                        if state.running.is_some() { "Running".to_string() }
                        else if state.waiting.is_some() { "Waiting".to_string() }
                        else if state.terminated.is_some() { "Terminated".to_string() }
                        else { "Unknown".to_string() }
                    } else { "Unknown".to_string() }
                })
                .collect::<Vec<_>>()
        })
    }

    fn sum_restarts(p: &Pod) -> Option<i32> {
        let mut total: i32 = 0;
        let mut has_any: bool = false;
        if let Some(st) = p.status.as_ref() {
            if let Some(css) = st.container_statuses.as_ref() {
                for cs in css.iter() { total += cs.restart_count; has_any = true; }
            }
            if let Some(ics) = st.init_container_statuses.as_ref() {
                for cs in ics.iter() { total += cs.restart_count; has_any = true; }
            }
        }
        if has_any { Some(total) } else { None }
    }

    fn aggregate_cpu(p: &Pod) -> Option<String> {
        let containers: &Vec<Container> = match p.spec.as_ref() { Some(sp) => &sp.containers, None => return None };
        let mut req_m: f64 = 0.0;
        let mut lim_m: f64 = 0.0;
        let mut has_req: bool = false;
        let mut has_lim: bool = false;
        for c in containers.iter() {
            if let Some(res) = c.resources.as_ref() {
                if let Some(reqs) = res.requests.as_ref() {
                    if let Some(q) = reqs.get("cpu") {
                        if let Some(v) = Self::cpu_qty_to_m(&q.0) { req_m += v; has_req = true; }
                    }
                }
                if let Some(lims) = res.limits.as_ref() {
                    if let Some(q) = lims.get("cpu") {
                        if let Some(v) = Self::cpu_qty_to_m(&q.0) { lim_m += v; has_lim = true; }
                    }
                }
            }
        }
        if !has_req && !has_lim { return None; }
        let req_str: String = if has_req { format!("{:.0}m", req_m) } else { "-".to_string() };
        let lim_str: String = if has_lim { format!("{:.0}m", lim_m) } else { "-".to_string() };
        if has_req && has_lim { Some(format!("{}/{}", req_str, lim_str)) } else { Some(req_str) }
    }

    fn aggregate_memory(p: &Pod) -> Option<String> {
        let containers: &Vec<Container> = match p.spec.as_ref() { Some(sp) => &sp.containers, None => return None };
        let mut req_b: f64 = 0.0;
        let mut lim_b: f64 = 0.0;
        let mut has_req: bool = false;
        let mut has_lim: bool = false;
        for c in containers.iter() {
            if let Some(res) = c.resources.as_ref() {
                if let Some(reqs) = res.requests.as_ref() {
                    if let Some(q) = reqs.get("memory") {
                        if let Some(v) = Bytes::qty_to_bytes(&q.0) { req_b += v; has_req = true; }
                    }
                }
                if let Some(lims) = res.limits.as_ref() {
                    if let Some(q) = lims.get("memory") {
                        if let Some(v) = Bytes::qty_to_bytes(&q.0) { lim_b += v; has_lim = true; }
                    }
                }
            }
        }
        if !has_req && !has_lim { return None; }
        let req_str: String = if has_req { Bytes::format_bytes_decimal(req_b) } else { "-".to_string() };
        let lim_str: String = if has_lim { Bytes::format_bytes_decimal(lim_b) } else { "-".to_string() };
        if has_req && has_lim { Some(format!("{}/{}", req_str, lim_str)) } else { Some(req_str) }
    }

    fn cpu_qty_to_m(s: &str) -> Option<f64> {
        let s: &str = s.trim();
        if s.is_empty() { return None; }
        if s.ends_with('m') {
            let num: &str = &s[..s.len()-1];
            num.parse::<f64>().ok()
        } else if s.ends_with('n') {
            let num: &str = &s[..s.len()-1];
            num.parse::<f64>().ok().map(|n| n / 1_000_000.0)
        } else if s.ends_with('u') {
            let num: &str = &s[..s.len()-1];
            num.parse::<f64>().ok().map(|u| u / 1000.0)
        } else {
            // assume cores, convert to milli-cores
            s.parse::<f64>().ok().map(|cores| cores * 1000.0)
        }
    }
}