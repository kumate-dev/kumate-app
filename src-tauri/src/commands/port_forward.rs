use crate::utils::port_forward::{PortForwardManager, PortForwardSession};
use anyhow::Result;
use rand::Rng;
use serde::Serialize;
use std::process::Stdio;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio::sync::mpsc;
use tokio::task::JoinHandle;

#[derive(Serialize, Clone)]
struct PortForwardEventPayload {
    r#type: String,
    line: String,
}

fn make_event_name(session_id: &str) -> String {
    format!("port_forward/{}", session_id)
}

#[tauri::command]
pub async fn start_port_forward(
    app_handle: AppHandle,
    state: tauri::State<'_, PortForwardManager>,
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
    let event_name: String = make_event_name(&session_id);

    let target: String = match resource_kind.as_str() {
        "pod" => format!("pod/{}", resource_name),
        "service" | "svc" => format!("svc/{}", resource_name),
        "deployment" | "deploy" => format!("deploy/{}", resource_name),
        "replicaset" | "rs" => format!("rs/{}", resource_name),
        "statefulset" | "sts" => format!("sts/{}", resource_name),
        "daemonset" | "ds" => format!("ds/{}", resource_name),
        _ => return Err(format!("unsupported resource kind: {}", resource_kind)),
    };

    let args: Vec<String> = vec![
        "port-forward".to_string(),
        target,
        format!("{}:{}", local_port, remote_port),
        "--context".to_string(),
        context,
        "-n".to_string(),
        namespace,
        "--address".to_string(),
        "127.0.0.1".to_string(),
    ];

    let (kill_tx, mut kill_rx) = mpsc::channel::<()>(1);
    let app: AppHandle = app_handle.clone();
    let ev_name: String = event_name.clone();

    let handle: JoinHandle<()> = tokio::spawn(async move {
        let mut cmd = Command::new("kubectl");
        cmd.args(&args).stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::piped());

        match cmd.spawn() {
            Ok(mut child) => {
                let mut stdout_lines = BufReader::new(child.stdout.take().unwrap()).lines();
                let mut stderr_lines = BufReader::new(child.stderr.take().unwrap()).lines();

                loop {
                    tokio::select! {
                        _ = kill_rx.recv() => {
                            let _ = child.kill().await;
                            let _ = app.emit(&ev_name, PortForwardEventPayload { r#type: "PF_DONE".into(), line: "stopped".into() });
                            break;
                        }
                        maybe_line = stdout_lines.next_line() => {
                            match maybe_line {
                                Ok(Some(line)) => {
                                    let _ = app.emit(&ev_name, PortForwardEventPayload { r#type: "PF_STDOUT".into(), line });
                                }
                                Ok(None) => {
                                    // stdout closed; wait for process exit
                                    if let Ok(status) = child.wait().await {
                                        let _ = app.emit(&ev_name, PortForwardEventPayload { r#type: "PF_DONE".into(), line: format!("exited: {}", status) });
                                    }
                                    break;
                                }
                                Err(e) => {
                                    let _ = app.emit(&ev_name, PortForwardEventPayload { r#type: "PF_ERROR".into(), line: e.to_string() });
                                }
                            }
                        }
                        maybe_line = stderr_lines.next_line() => {
                            match maybe_line {
                                Ok(Some(line)) => {
                                    let _ = app.emit(&ev_name, PortForwardEventPayload { r#type: "PF_STDERR".into(), line });
                                }
                                Ok(None) => {}
                                Err(e) => {
                                    let _ = app.emit(&ev_name, PortForwardEventPayload { r#type: "PF_ERROR".into(), line: e.to_string() });
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
                        line: format!("failed to spawn kubectl: {}", e),
                    },
                );
            }
        }
    });

    state.insert(session_id.clone(), PortForwardSession { kill_tx, handle }).await;

    Ok(serde_json::json!({
        "eventName": event_name,
        "sessionId": session_id,
    }))
}

#[tauri::command]
pub async fn stop_port_forward(
    state: tauri::State<'_, PortForwardManager>,
    session_id: String,
) -> Result<(), String> {
    state.stop(&session_id).await
}
