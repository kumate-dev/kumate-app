use std::sync::Arc;

use crate::{
    commands::common::watch,
    manager::k8s::{pod_resources::PodResources, resources::K8sResources},
    utils::watcher::WatchManager,
};
use k8s_openapi::api::core::v1::Pod;
use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, Emitter};

#[tauri::command]
pub async fn create_pod(
    name: String,
    namespace: Option<String>,
    manifest: Value,
) -> Result<Value, String> {
    K8sResources::<Pod>::create(name, namespace, manifest).await
}

#[tauri::command]
pub async fn update_pod(
    name: String,
    namespace: Option<String>,
    manifest: Value,
) -> Result<Value, String> {
    K8sResources::<Pod>::update(name, namespace, manifest).await
}

#[tauri::command]
pub async fn list_pods(
    name: String,
    namespaces: Option<Vec<String>>,
) -> Result<Vec<Value>, String> {
    K8sResources::<Pod>::list(name, namespaces).await
}

#[tauri::command]
pub async fn watch_pods(
    app_handle: AppHandle,
    name: String,
    namespaces: Option<Vec<String>>,
    state: tauri::State<'_, WatchManager>,
) -> Result<String, String> {
    watch(
        app_handle,
        name,
        "pods".to_string(),
        namespaces,
        state,
        Arc::new(K8sResources::<Pod>::watch),
    )
    .await
}

#[tauri::command]
pub async fn delete_pods(
    name: String,
    namespace: Option<String>,
    resource_names: Vec<String>,
) -> Result<Vec<Result<String, String>>, String> {
    Ok(K8sResources::<Pod>::delete(name, namespace, resource_names).await?)
}

#[tauri::command]
pub async fn get_pod_logs(
    context: String,
    namespace: String,
    pod_name: String,
    container_name: Option<String>,
    tail_lines: Option<i64>,
) -> Result<String, String> {
    PodResources::get_logs(context, namespace, pod_name, container_name, tail_lines).await
}

#[tauri::command]
pub async fn watch_pod_logs(
    app_handle: AppHandle,
    context: String,
    namespace: String,
    pod_name: String,
    container_name: Option<String>,
    tail_lines: Option<i64>,
    state: tauri::State<'_, WatchManager>,
) -> Result<String, String> {
    let resource = match &container_name {
        Some(c) => format!("pod_logs/{}/{}/{}", namespace, pod_name, c),
        None => format!("pod_logs/{}/{}", namespace, pod_name),
    };

    watch(
        app_handle,
        context.clone(),
        resource,
        None,
        state,
        Arc::new(move |app_handle, name, _namespaces, event_name| {
            let ns = namespace.clone();
            let pod = pod_name.clone();
            let container = container_name.clone();
            let tails = tail_lines;

            async move {
                PodResources::watch_logs(app_handle, name, ns, pod, container, event_name, tails)
                    .await
            }
        }),
    )
    .await
}

#[tauri::command]
pub async fn exec_pod(
    context: String,
    namespace: String,
    pod_name: String,
    container_name: Option<String>,
    command: Vec<String>,
    tty: Option<bool>,
) -> Result<String, String> {
    PodResources::exec(context, namespace, pod_name, container_name, command, tty.unwrap_or(false))
        .await
}

#[derive(Serialize)]
pub struct ExecStartResult {
    pub event_name: String,
    pub session_id: String,
}

#[tauri::command]
pub async fn start_exec_pod(
    app_handle: AppHandle,
    context: String,
    namespace: String,
    pod_name: String,
    container_name: Option<String>,
    command: Option<Vec<String>>,
    tty: Option<bool>,
    state: tauri::State<'_, crate::utils::exec::ExecManager>,
) -> Result<ExecStartResult, String> {
    use crate::manager::k8s::client::K8sClient;
    use k8s_openapi::chrono::Utc;
    use kube::api::{Api, AttachParams};
    use kube::Client;
    use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
    use tokio::sync::mpsc;
    use uuid::Uuid;

    let client: Client = K8sClient::for_context(&context).await?;
    let api: Api<Pod> = K8sClient::api::<Pod>(client, Some(namespace.clone())).await;

    let tty_flag: bool = tty.unwrap_or(true);
    let mut params: AttachParams =
        AttachParams::default().stdin(true).stdout(true).stderr(!tty_flag).tty(tty_flag);

    if let Some(container) = container_name.clone() {
        params = params.container(container);
    }

    let cmd: Vec<String> = command.unwrap_or_else(|| vec!["sh".into()]);

    let mut attached = api
        .exec(&pod_name, cmd, &params)
        .await
        .map_err(|e| format!("Failed to start exec: {}", e))?;

    let (stdin_tx, mut stdin_rx) = mpsc::channel::<Vec<u8>>(32);

    let stdout_opt = attached.stdout().take();
    let stderr_opt = attached.stderr().take();
    let stdin_opt = attached.stdin().take();

    let event_name: String = format!(
        "k8s://{}/exec/{}/{}/{}",
        context,
        namespace,
        pod_name,
        container_name.clone().unwrap_or_else(|| "_".into())
    );
    let session_id: String = Uuid::new_v4().to_string();
    let event_name_emit: String = event_name.clone();

    let handle = tokio::spawn(async move {
        if let Some(mut stdin) = stdin_opt {
            tokio::spawn(async move {
                while let Some(data) = stdin_rx.recv().await {
                    let _ = stdin.write_all(&data).await;
                    let _ = stdin.flush().await;
                }
            });
        }

        if let Some(mut stdout) = stdout_opt {
            if tty_flag {
                let mut buf = [0u8; 1024];
                loop {
                    match stdout.read(&mut buf).await {
                        Ok(0) => break,
                        Ok(n) => {
                            let data_chunk = String::from_utf8_lossy(&buf[..n]).to_string();
                            let event_data: Value = serde_json::json!({
                                "type": "EXEC_STDOUT",
                                "pod": pod_name,
                                "namespace": namespace,
                                "container": container_name,
                                "data": data_chunk,
                                "timestamp": Utc::now().to_rfc3339()
                            });
                            let _ = app_handle.emit(&event_name_emit, event_data);
                        }
                        Err(_) => break,
                    }
                }
            } else {
                let mut lines = BufReader::new(stdout).lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    let event_data: Value = serde_json::json!({
                        "type": "EXEC_STDOUT",
                        "pod": pod_name,
                        "namespace": namespace,
                        "container": container_name,
                        "data": line,
                        "timestamp": Utc::now().to_rfc3339()
                    });
                    let _ = app_handle.emit(&event_name_emit, event_data);
                }
            }
        }

        if !tty_flag {
            if let Some(stderr) = stderr_opt {
                let mut lines = BufReader::new(stderr).lines();
                while let Ok(Some(line)) = lines.next_line().await {
                    let event_data: Value = serde_json::json!({
                        "type": "EXEC_STDERR",
                        "pod": pod_name,
                        "namespace": namespace,
                        "container": container_name,
                        "data": line,
                        "timestamp": Utc::now().to_rfc3339()
                    });
                    let _ = app_handle.emit(&event_name_emit, event_data);
                }
            }
        }

        let completed: Value = serde_json::json!({
            "type": "EXEC_COMPLETED",
            "pod": pod_name,
            "namespace": namespace,
            "container": container_name,
            "timestamp": Utc::now().to_rfc3339()
        });
        let _ = app_handle.emit(&event_name_emit, completed);
    });

    state.insert(session_id.clone(), crate::utils::exec::ExecSession { stdin_tx, handle }).await;

    Ok(ExecStartResult {
        event_name,
        session_id,
    })
}

#[tauri::command]
pub async fn send_exec_input(
    session_id: String,
    input: String,
    append_newline: Option<bool>,
    state: tauri::State<'_, crate::utils::exec::ExecManager>,
) -> Result<(), String> {
    let mut data = input.into_bytes();
    if append_newline.unwrap_or(true) {
        data.push(b'\n');
    }
    state.send(&session_id, data).await
}

#[tauri::command]
pub async fn stop_exec_pod(
    session_id: String,
    state: tauri::State<'_, crate::utils::exec::ExecManager>,
) -> Result<(), String> {
    state.stop(&session_id).await
}
