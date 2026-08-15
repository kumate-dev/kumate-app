use crate::manager::k8s::client::K8sClient;
use futures_util::{AsyncBufReadExt, StreamExt};
// k8s-openapi 0.27 replaced chrono with jiff internally and stopped re-exporting chrono,
// so the event-payload clock is jiff's. `Timestamp::to_string()` is RFC 3339 with a `Z`
// offset and no RFC 9557 zone annotation, which `new Date(...)` on the frontend parses
// exactly as it parsed chrono's `+00:00` form.
use jiff::Timestamp;
use k8s_openapi::api::core::v1::Pod;
use kube::{
    api::{Api, AttachParams, LogParams},
    Client,
};
use serde_json::Value;
use tauri::{AppHandle, Emitter};

pub struct PodResources;

/// Maximum number of log lines carried in a single `LOG_LINES` event.
const LOG_BATCH_MAX_LINES: usize = 64;

/// Upper bound on how long a line may sit in the batch before it is emitted.
const LOG_BATCH_INTERVAL: std::time::Duration = std::time::Duration::from_millis(100);

impl PodResources {
    pub async fn get_logs(
        context_name: String,
        namespace: String,
        pod_name: String,
        container_name: Option<String>,
        tail_lines: Option<i64>,
    ) -> Result<String, String> {
        let client: Client = K8sClient::for_context(&context_name).await?;
        let api: Api<Pod> = K8sClient::api::<Pod>(client, Some(namespace)).await;

        let log_params: LogParams = LogParams {
            container: container_name,
            tail_lines,
            follow: false,
            timestamps: false,
            since_time: None,
            since_seconds: None,
            limit_bytes: None,
            pretty: false,
            previous: false,
        };

        let logs: String = api
            .logs(&pod_name, &log_params)
            .await
            .map_err(|e| format!("Failed to get logs for pod {}: {}", pod_name, e))?;

        Ok(logs)
    }

    pub async fn watch_logs(
        app_handle: AppHandle,
        context_name: String,
        namespace: String,
        pod_name: String,
        container_name: Option<String>,
        event_name: String,
        tail_lines: Option<i64>,
    ) -> Result<(), String> {
        let client: Client = K8sClient::for_context(&context_name).await?;
        let api: Api<Pod> = K8sClient::api::<Pod>(client, Some(namespace.clone())).await;

        let log_params: LogParams = LogParams {
            container: container_name.clone(),
            tail_lines,
            follow: true,
            timestamps: false,
            since_time: None,
            since_seconds: None,
            limit_bytes: None,
            pretty: false,
            previous: false,
        };

        let reader = api
            .log_stream(&pod_name, &log_params)
            .await
            .map_err(|e| format!("Failed to start log stream for pod {}: {}", pod_name, e))?;

        let mut lines = reader.lines();

        // Coalesce log lines into batches. Emitting one Tauri event per line means a
        // chatty pod (thousands of lines a second is normal for an access log) turns
        // into thousands of IPC messages and React state updates per second, which
        // starves the rest of the UI. Flush whichever comes first: a full batch, or
        // the interval — so a quiet pod still shows its lines promptly.
        let mut batch: Vec<String> = Vec::with_capacity(LOG_BATCH_MAX_LINES);
        let mut flush_timer = tokio::time::interval(LOG_BATCH_INTERVAL);
        // Default `Burst` behaviour would fire back-to-back ticks to catch up after a
        // slow emit; we only care about "at least every 100ms".
        flush_timer.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
        // The first tick of an `interval` resolves immediately; consume it so the
        // first real flush is a full interval away.
        flush_timer.tick().await;

        loop {
            tokio::select! {
                // Both branches are cancel-safe: `Lines` keeps its partial-line
                // buffer inside the struct, so dropping a pending `next()` when the
                // timer wins loses nothing.
                next_line = lines.next() => {
                    match next_line {
                        Some(Ok(log_line)) => {
                            batch.push(log_line);
                            if batch.len() >= LOG_BATCH_MAX_LINES {
                                Self::emit_log_batch(
                                    &app_handle,
                                    &event_name,
                                    &pod_name,
                                    &namespace,
                                    &container_name,
                                    &mut batch,
                                );
                            }
                        }
                        Some(Err(e)) => {
                            // Flush first so the lines that preceded the failure are
                            // not swallowed by it.
                            Self::emit_log_batch(
                                &app_handle,
                                &event_name,
                                &pod_name,
                                &namespace,
                                &container_name,
                                &mut batch,
                            );

                            let error_data: Value = serde_json::json!({
                                "type": "LOG_ERROR",
                                "pod": pod_name,
                                "namespace": namespace,
                                "container": container_name,
                                "error": e.to_string(),
                                "timestamp": Timestamp::now().to_string()
                            });

                            let _ = app_handle.emit(&event_name, error_data);
                            break;
                        }
                        None => {
                            Self::emit_log_batch(
                                &app_handle,
                                &event_name,
                                &pod_name,
                                &namespace,
                                &container_name,
                                &mut batch,
                            );
                            break;
                        }
                    }
                }
                _ = flush_timer.tick() => {
                    Self::emit_log_batch(
                        &app_handle,
                        &event_name,
                        &pod_name,
                        &namespace,
                        &container_name,
                        &mut batch,
                    );
                }
            }
        }

        let completed_data: Value = serde_json::json!({
            "type": "LOG_COMPLETED",
            "pod": pod_name,
            "namespace": namespace,
            "container": container_name,
            "timestamp": Timestamp::now().to_string()
        });

        let _ = app_handle.emit(&event_name, completed_data);

        Ok(())
    }

    /// Emit the buffered lines as one `LOG_LINES` event and clear the buffer.
    ///
    /// `LOG_LINES` is a new event shape carrying a `logs` array; the old
    /// one-line-per-event `LOG_LINE` shape is no longer produced here (see
    /// `src/hooks/useViewPodLogs.ts`, which handles both).
    fn emit_log_batch(
        app_handle: &AppHandle,
        event_name: &str,
        pod_name: &str,
        namespace: &str,
        container_name: &Option<String>,
        batch: &mut Vec<String>,
    ) {
        if batch.is_empty() {
            return;
        }

        // `drain` rather than `mem::take` so the buffer keeps its capacity for the
        // next batch.
        let logs: Vec<String> = batch.drain(..).collect();
        let event_data: Value = serde_json::json!({
            "type": "LOG_LINES",
            "pod": pod_name,
            "namespace": namespace,
            "container": container_name,
            "logs": logs,
            "timestamp": Timestamp::now().to_string()
        });

        let _ = app_handle.emit(event_name, event_data);
    }

    pub async fn exec(
        context_name: String,
        namespace: String,
        pod_name: String,
        container_name: Option<String>,
        command: Vec<String>,
        tty: bool,
    ) -> Result<String, String> {
        let client: Client = K8sClient::for_context(&context_name).await?;
        let api: Api<Pod> = K8sClient::api::<Pod>(client, Some(namespace)).await;

        let mut params: AttachParams = AttachParams::default()
            .stdin(false)
            .stdout(true)
            .stderr(!tty)
            .tty(tty);

        if let Some(container) = container_name.clone() {
            params = params.container(container);
        }

        let mut attached = api
            .exec(&pod_name, command, &params)
            .await
            .map_err(|e| format!("Failed to exec in pod {}: {}", pod_name, e))?;

        // kube 4 aborts the websocket pump task in `AttachedProcess::drop`, so `attached`
        // has to outlive the reads below — it does, because it is a local that is only
        // dropped when this function returns. No `join()`/`take_status()` here on purpose:
        // this is a one-shot command whose value is the captured output, and `join()`
        // drops the stdio channels before awaiting, which would truncate it.
        use tokio::io::AsyncReadExt;
        let mut out = String::new();

        if let Some(mut stdout) = attached.stdout().take() {
            let mut buf: Vec<u8> = Vec::new();
            stdout
                .read_to_end(&mut buf)
                .await
                .map_err(|e| format!("Failed to read stdout: {}", e))?;
            out.push_str(&String::from_utf8_lossy(&buf));
        }

        if !tty {
            if let Some(mut stderr) = attached.stderr().take() {
                let mut buf: Vec<u8> = Vec::new();
                stderr
                    .read_to_end(&mut buf)
                    .await
                    .map_err(|e| format!("Failed to read stderr: {}", e))?;
                out.push_str(&String::from_utf8_lossy(&buf));
            }
        }

        Ok(out)
    }
}
