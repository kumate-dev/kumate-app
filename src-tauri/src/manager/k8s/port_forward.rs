use crate::manager::k8s::client::K8sClient;
use crate::utils::port_forward::{PortForwardManager, PortForwardSession};
use k8s_openapi::api::apps::v1::{DaemonSet, Deployment, ReplicaSet, StatefulSet};
use k8s_openapi::api::core::v1::{Pod, Service};
use kube::api::{Api, ListParams};
use kube::Client;
use rand::Rng;
use serde::Serialize;
use std::collections::BTreeMap;
use tauri::{AppHandle, Emitter};
use tokio::io;
use tokio::net::TcpListener;
use tokio::sync::mpsc;
use tokio::task::JoinHandle;

#[derive(Serialize, Clone)]
struct PortForwardEventPayload {
    r#type: String,
    line: String,
}

pub struct PortForwarder<'a> {
    app: AppHandle,
    state: &'a PortForwardManager,
}

impl<'a> PortForwarder<'a> {
    pub fn new(app: AppHandle, state: &'a PortForwardManager) -> Self {
        Self { app, state }
    }

    fn make_event_name(session_id: &str) -> String {
        format!("port_forward/{}", session_id)
    }

    fn labels_to_selector(labels: &BTreeMap<String, String>) -> Option<String> {
        if labels.is_empty() {
            None
        } else {
            Some(labels.iter().map(|(k, v)| format!("{}={}", k, v)).collect::<Vec<_>>().join(","))
        }
    }

    async fn resolve_target_pod(
        &self,
        client: Client,
        namespace: String,
        resource_kind: String,
        resource_name: String,
    ) -> Result<String, String> {
        match resource_kind.as_str() {
            "pod" => Ok(resource_name),
            "service" | "svc" => {
                let svc_api: Api<Service> =
                    K8sClient::api::<Service>(client.clone(), Some(namespace.clone())).await;
                let svc: Service = svc_api
                    .get(&resource_name)
                    .await
                    .map_err(|e| format!("failed to get service {}: {}", resource_name, e))?;
                let selector = svc.spec.and_then(|s| s.selector).unwrap_or_default();
                let pods_api: Api<Pod> =
                    K8sClient::api::<Pod>(client.clone(), Some(namespace.clone())).await;
                let lp = match Self::labels_to_selector(&selector) {
                    Some(s) => ListParams::default().labels(&s),
                    None => ListParams::default(),
                };
                let pods = pods_api.list(&lp).await.map_err(|e| {
                    format!("failed to list pods for service {}: {}", resource_name, e)
                })?;
                let name = pods
                    .items
                    .into_iter()
                    .find_map(|p| p.metadata.name)
                    .ok_or_else(|| "no backing pods found".to_string())?;
                Ok(name)
            }
            "deployment" | "deploy" => {
                let api: Api<Deployment> =
                    K8sClient::api::<Deployment>(client.clone(), Some(namespace.clone())).await;
                let dep: Deployment = api
                    .get(&resource_name)
                    .await
                    .map_err(|e| format!("failed to get deployment {}: {}", resource_name, e))?;
                let selector =
                    dep.spec.map(|s| s.selector).and_then(|ls| ls.match_labels).unwrap_or_default();
                let pods_api: Api<Pod> =
                    K8sClient::api::<Pod>(client.clone(), Some(namespace.clone())).await;
                let lp = match Self::labels_to_selector(&selector) {
                    Some(s) => ListParams::default().labels(&s),
                    None => ListParams::default(),
                };
                let pods = pods_api.list(&lp).await.map_err(|e| {
                    format!("failed to list pods for deployment {}: {}", resource_name, e)
                })?;
                let name = pods
                    .items
                    .into_iter()
                    .find_map(|p| p.metadata.name)
                    .ok_or_else(|| "no backing pods found".to_string())?;
                Ok(name)
            }
            "replicaset" | "rs" => {
                let api: Api<ReplicaSet> =
                    K8sClient::api::<ReplicaSet>(client.clone(), Some(namespace.clone())).await;
                let rs: ReplicaSet = api
                    .get(&resource_name)
                    .await
                    .map_err(|e| format!("failed to get replicaset {}: {}", resource_name, e))?;
                let selector =
                    rs.spec.map(|s| s.selector).and_then(|ls| ls.match_labels).unwrap_or_default();
                let pods_api: Api<Pod> =
                    K8sClient::api::<Pod>(client.clone(), Some(namespace.clone())).await;
                let lp = match Self::labels_to_selector(&selector) {
                    Some(s) => ListParams::default().labels(&s),
                    None => ListParams::default(),
                };
                let pods = pods_api.list(&lp).await.map_err(|e| {
                    format!("failed to list pods for replicaset {}: {}", resource_name, e)
                })?;
                let name = pods
                    .items
                    .into_iter()
                    .find_map(|p| p.metadata.name)
                    .ok_or_else(|| "no backing pods found".to_string())?;
                Ok(name)
            }
            "statefulset" | "sts" => {
                let api: Api<StatefulSet> =
                    K8sClient::api::<StatefulSet>(client.clone(), Some(namespace.clone())).await;
                let sts: StatefulSet = api
                    .get(&resource_name)
                    .await
                    .map_err(|e| format!("failed to get statefulset {}: {}", resource_name, e))?;
                let selector =
                    sts.spec.map(|s| s.selector).and_then(|ls| ls.match_labels).unwrap_or_default();
                let pods_api: Api<Pod> =
                    K8sClient::api::<Pod>(client.clone(), Some(namespace.clone())).await;
                let lp = match Self::labels_to_selector(&selector) {
                    Some(s) => ListParams::default().labels(&s),
                    None => ListParams::default(),
                };
                let pods = pods_api.list(&lp).await.map_err(|e| {
                    format!("failed to list pods for statefulset {}: {}", resource_name, e)
                })?;
                let name = pods
                    .items
                    .into_iter()
                    .find_map(|p| p.metadata.name)
                    .ok_or_else(|| "no backing pods found".to_string())?;
                Ok(name)
            }
            "daemonset" | "ds" => {
                let api: Api<DaemonSet> =
                    K8sClient::api::<DaemonSet>(client.clone(), Some(namespace.clone())).await;
                let ds: DaemonSet = api
                    .get(&resource_name)
                    .await
                    .map_err(|e| format!("failed to get daemonset {}: {}", resource_name, e))?;
                let selector =
                    ds.spec.map(|s| s.selector).and_then(|ls| ls.match_labels).unwrap_or_default();
                let pods_api: Api<Pod> =
                    K8sClient::api::<Pod>(client.clone(), Some(namespace.clone())).await;
                let lp = match Self::labels_to_selector(&selector) {
                    Some(s) => ListParams::default().labels(&s),
                    None => ListParams::default(),
                };
                let pods = pods_api.list(&lp).await.map_err(|e| {
                    format!("failed to list pods for daemonset {}: {}", resource_name, e)
                })?;
                let name = pods
                    .items
                    .into_iter()
                    .find_map(|p| p.metadata.name)
                    .ok_or_else(|| "no backing pods found".to_string())?;
                Ok(name)
            }
            _ => Err(format!("unsupported resource kind: {}", resource_kind)),
        }
    }

    async fn spawn_forward_task(
        &self,
        pods_api: Api<Pod>,
        pod_name: String,
        local_port: u16,
        remote_port: u16,
        event_name: String,
        context: String,
        namespace: String,
        resource_kind: String,
        resource_name: String,
    ) -> PortForwardSession {
        let (kill_tx, mut kill_rx) = mpsc::channel::<()>(1);
        let app = self.app.clone();
        let ev_name = event_name.clone();

        let handle: JoinHandle<()> = tokio::spawn(async move {
            match pods_api.portforward(&pod_name, &[remote_port]).await {
                Ok(mut pf) => {
                    match TcpListener::bind(("127.0.0.1", local_port)).await {
                        Ok(listener) => {
                            let _ = app.emit(
                                &ev_name,
                                PortForwardEventPayload {
                                    r#type: "PF_STDOUT".into(),
                                    line: format!(
                                        "listening on 127.0.0.1:{} -> {}:{}",
                                        local_port, pod_name, remote_port
                                    ),
                                },
                            );
                            loop {
                                tokio::select! {
                                  _ = kill_rx.recv() => {
                                    let _ = app.emit(&ev_name, PortForwardEventPayload { r#type: "PF_DONE".into(), line: "stopped".into() });
                                    break;
                                  }
                                  incoming = listener.accept() => {
                                    match incoming {
                                      Ok((mut socket, _addr)) => {
                                        let mut attempts: u8 = 20; // ~2s total with 100ms sleep
                                        let mut got_stream = false;
                                        while attempts > 0 {
                                          if let Some(mut remote) = pf.take_stream(remote_port) {
                                            got_stream = true;
                                            tokio::spawn(async move {
                                              let _ = io::copy_bidirectional(&mut socket, &mut remote).await;
                                            });
                                            break;
                                          } else {
                                            attempts -= 1;
                                            tokio::time::sleep(std::time::Duration::from_millis(100)).await;
                                          }
                                        }

                                        if !got_stream {
                                          let _ = app.emit(&ev_name, PortForwardEventPayload { r#type: "PF_ERROR".into(), line: format!("no remote stream available for port {} after retries", remote_port) });
                                        }
                                      }
                                      Err(e) => {
                                        let _ = app.emit(&ev_name, PortForwardEventPayload { r#type: "PF_ERROR".into(), line: format!("listener accept error: {}", e) });
                                      }
                                    }
                                  }
                                }
                            }
                        }
                        Err(e) => {
                            let _ = app.emit(
                                &ev_name,
                                PortForwardEventPayload {
                                    r#type: "PF_ERROR".into(),
                                    line: format!(
                                        "failed to bind local port {}: {}",
                                        local_port, e
                                    ),
                                },
                            );
                        }
                    }
                }
                Err(e) => {
                    let _ = app.emit(
                        &ev_name,
                        PortForwardEventPayload {
                            r#type: "PF_ERROR".into(),
                            line: format!("portforward start error: {}", e),
                        },
                    );
                }
            }
        });

        PortForwardSession {
            kill_tx,
            handle,
            context,
            namespace,
            resource_kind,
            resource_name,
            local_port,
            remote_port,
        }
    }

    pub async fn start(
        &self,
        context: String,
        namespace: String,
        resource_kind: String,
        resource_name: String,
        local_port: u16,
        remote_port: u16,
    ) -> Result<serde_json::Value, String> {
        let session_id: String = {
            let mut rng = rand::thread_rng();
            format!("pf-{:08x}", rng.gen::<u32>())
        };
        let event_name: String = Self::make_event_name(&session_id);

        let client: Client = K8sClient::for_context(&context).await?;
        let pod_name: String = self
            .resolve_target_pod(
                client.clone(),
                namespace.clone(),
                resource_kind.clone(),
                resource_name.clone(),
            )
            .await?;
        let pods_api: Api<Pod> =
            K8sClient::api::<Pod>(client.clone(), Some(namespace.clone())).await;

        let session = self
            .spawn_forward_task(
                pods_api,
                pod_name,
                local_port,
                remote_port,
                event_name.clone(),
                context.clone(),
                namespace.clone(),
                resource_kind.clone(),
                resource_name.clone(),
            )
            .await;
        self.state.insert(session_id.clone(), session).await;

        Ok(serde_json::json!({
          "eventName": event_name,
          "sessionId": session_id,
        }))
    }

    pub async fn stop(
        state: tauri::State<'_, PortForwardManager>,
        session_id: String,
    ) -> Result<(), String> {
        state.stop(&session_id).await
    }
}
