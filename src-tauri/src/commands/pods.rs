use crate::{
    commands::common::start_watch,
    error::{AppError, AppResult},
    manager::k8s::{pod_resources::PodResources, resources::K8sResources},
    utils::watcher::{build_event_name, WatchManager},
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
) -> AppResult<Value> {
    K8sResources::<Pod>::create(name, namespace, manifest).await
}

#[tauri::command]
pub async fn update_pod(
    name: String,
    namespace: Option<String>,
    manifest: Value,
) -> AppResult<Value> {
    K8sResources::<Pod>::update(name, namespace, manifest).await
}

#[tauri::command]
pub async fn list_pods(name: String, namespaces: Option<Vec<String>>) -> AppResult<Vec<Value>> {
    K8sResources::<Pod>::list(name, namespaces).await
}

#[tauri::command]
pub async fn watch_pods(
    app_handle: AppHandle,
    name: String,
    namespaces: Option<Vec<String>>,
    state: tauri::State<'_, WatchManager>,
) -> AppResult<String> {
    start_watch(
        app_handle,
        name,
        // `&str` now: `start_watch` only borrows the segment to build the event name.
        "pods",
        namespaces,
        state,
        // `K8sResources::<Pod>::watch` takes the `CancellationToken` as its final
        // parameter, so the fn item satisfies `start_watch`'s `FnOnce` bound directly
        // and no `Arc` wrapper is needed.
        K8sResources::<Pod>::watch,
    )
    .await
}

#[tauri::command]
pub async fn delete_pods(
    name: String,
    namespace: Option<String>,
    resource_names: Vec<String>,
) -> AppResult<Vec<Result<String, String>>> {
    // The per-item error stays a plain `String`: that is the wire shape the UI parses.
    K8sResources::<Pod>::delete(name, namespace, resource_names).await
}

#[tauri::command]
pub async fn get_pod_logs(
    context: String,
    namespace: String,
    pod_name: String,
    container_name: Option<String>,
    tail_lines: Option<i64>,
) -> AppResult<String> {
    // `PodResources` has not been migrated to `AppResult` yet, so its already-formatted
    // message is bridged into the closest variant here rather than being re-derived.
    PodResources::get_logs(context, namespace, pod_name, container_name, tail_lines)
        .await
        .map_err(AppError::Internal)
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
) -> AppResult<String> {
    let resource = match &container_name {
        Some(c) => format!("pod_logs/{}/{}/{}", namespace, pod_name, c),
        None => format!("pod_logs/{}/{}", namespace, pod_name),
    };

    // Deliberately *not* routed through `common::start_watch`: that helper runs
    // `validate_resource_name`, which rejects any segment containing '/', and a log
    // channel is the multi-segment `pod_logs/<ns>/<pod>[/<container>]` path above.
    // Building the name here keeps the existing channel identifier byte-for-byte
    // (`build_event_name` with no namespaces produces `k8s://<ctx>/<resource>`, which
    // is exactly what the old `watch` produced) while still registering the watch with
    // the same `WatchManager`, so `unwatch` / `unwatch_cluster` keep working.
    let event_name = build_event_name(&context, &resource, None);
    let event_name_for_task = event_name.clone();

    state
        .watch(
            app_handle,
            event_name.clone(),
            move |app, cancel| async move {
                // `PodResources::watch_logs` does not take a `CancellationToken`, so the
                // token is honoured by dropping the log-stream future when it fires. Both
                // select branches are cancel-safe; the stream owns no state we must flush.
                tokio::select! {
                    biased;
                    _ = cancel.cancelled() => Ok(()),
                    res = PodResources::watch_logs(
                        app,
                        context,
                        namespace,
                        pod_name,
                        container_name,
                        event_name_for_task,
                        tail_lines,
                    ) => res.map_err(AppError::Internal),
                }
            },
        )
        .await?;

    Ok(event_name)
}

#[tauri::command]
pub async fn exec_pod(
    context: String,
    namespace: String,
    pod_name: String,
    container_name: Option<String>,
    command: Vec<String>,
    tty: Option<bool>,
) -> AppResult<String> {
    // Same bridge as `get_pod_logs`: `PodResources` still returns plain strings.
    PodResources::exec(
        context,
        namespace,
        pod_name,
        container_name,
        command,
        tty.unwrap_or(false),
    )
    .await
    .map_err(AppError::Internal)
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
) -> AppResult<ExecStartResult> {
    use crate::manager::k8s::client::K8sClient;
    // jiff replaces the `k8s_openapi::chrono` re-export that 0.27 removed. `Timestamp`'s
    // `Display` is RFC 3339 with a `Z` offset and no RFC 9557 zone annotation.
    use jiff::Timestamp;
    use kube::api::{Api, AttachParams};
    use kube::Client;
    use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
    use tokio::sync::mpsc;
    use uuid::Uuid;

    let client: Client = K8sClient::for_context(&context).await?;
    let api: Api<Pod> = K8sClient::api::<Pod>(client, Some(namespace.clone())).await;

    let tty_flag: bool = tty.unwrap_or(true);
    let mut params: AttachParams = AttachParams::default()
        .stdin(true)
        .stdout(true)
        .stderr(!tty_flag)
        .tty(tty_flag);

    if let Some(container) = container_name.clone() {
        params = params.container(container);
    }

    let cmd: Vec<String> = command.unwrap_or_else(|| vec!["sh".into()]);

    // Structured apiserver error instead of a hand-formatted string, so the frontend
    // can branch on `code` (403 on a locked-down exec subresource is common).
    let mut attached = api
        .exec(&pod_name, cmd, &params)
        .await
        .map_err(|e| AppError::from_kube(&e, &pod_name))?;

    let (stdin_tx, mut stdin_rx) = mpsc::channel::<Vec<u8>>(32);

    let stdout_opt = attached.stdout().take();
    let stderr_opt = attached.stderr().take();
    let stdin_opt = attached.stdin().take();

    // Order matters in kube 4: `join()` takes `self` by value and drops the stdio channels
    // *and* the status receiver before awaiting the task, so a `take_status()` issued after
    // it can never resolve. Take it here, await it inside the session task.
    let status_fut = attached.take_status();

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
        // `attached` is moved in deliberately. kube 4 added `impl Drop for AttachedProcess`
        // that aborts the background websocket pump, so leaving it as a local of
        // `start_exec_pod` would tear the session down the instant this command returned
        // and every terminal would open dead. Its lifetime is now the session's lifetime,
        // which also means `ExecManager::stop` aborting this task closes the socket.
        let attached = attached;

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
                                "timestamp": Timestamp::now().to_string()
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
                        "timestamp": Timestamp::now().to_string()
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
                        "timestamp": Timestamp::now().to_string()
                    });
                    let _ = app_handle.emit(&event_name_emit, event_data);
                }
            }
        }

        // Drain the status before joining, otherwise kube's task fails its final
        // `status_tx.send(..)` against a dropped receiver and `join()` reports
        // `SendStatus` for a process that exited perfectly normally.
        if let Some(status) = status_fut {
            let _ = status.await;
        }
        if let Err(e) = attached.join().await {
            tracing::debug!(
                error = %crate::error::redact(&e.to_string()),
                "exec session ended with an error"
            );
        }

        let completed: Value = serde_json::json!({
            "type": "EXEC_COMPLETED",
            "pod": pod_name,
            "namespace": namespace,
            "container": container_name,
            "timestamp": Timestamp::now().to_string()
        });
        let _ = app_handle.emit(&event_name_emit, completed);
    });

    state
        .insert(
            session_id.clone(),
            crate::utils::exec::ExecSession { stdin_tx, handle },
        )
        .await;

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
) -> AppResult<()> {
    let mut data = input.into_bytes();
    if append_newline.unwrap_or(true) {
        data.push(b'\n');
    }
    // `ExecManager` still returns plain strings (both "session not found" and a closed
    // stdin channel), so they are bridged rather than reclassified here.
    state
        .send(&session_id, data)
        .await
        .map_err(AppError::Internal)
}

#[tauri::command]
pub async fn stop_exec_pod(
    session_id: String,
    state: tauri::State<'_, crate::utils::exec::ExecManager>,
) -> AppResult<()> {
    state.stop(&session_id).await.map_err(AppError::Internal)
}
