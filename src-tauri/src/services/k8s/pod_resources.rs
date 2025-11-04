use crate::services::k8s::client::K8sClient;
use futures_util::{AsyncBufReadExt, StreamExt};
use k8s_openapi::{api::core::v1::Pod, chrono};
use kube::{
    api::{Api, LogParams},
    Client,
};
use serde_json::Value;
use tauri::{AppHandle, Emitter};

pub struct PodResources;

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

        while let Some(line) = lines.next().await {
            match line {
                Ok(log_line) => {
                    let event_data: Value = serde_json::json!({
                        "type": "LOG_LINE",
                        "pod": pod_name,
                        "namespace": namespace,
                        "container": container_name,
                        "log": log_line,
                        "timestamp": chrono::Utc::now().to_rfc3339()
                    });

                    let _ = app_handle.emit(&event_name, event_data);
                }
                Err(e) => {
                    let error_data: Value = serde_json::json!({
                        "type": "LOG_ERROR",
                        "pod": pod_name,
                        "namespace": namespace,
                        "container": container_name,
                        "error": e.to_string(),
                        "timestamp": chrono::Utc::now().to_rfc3339()
                    });

                    let _ = app_handle.emit(&event_name, error_data);
                    break;
                }
            }
        }

        let completed_data: Value = serde_json::json!({
            "type": "LOG_COMPLETED",
            "pod": pod_name,
            "namespace": namespace,
            "container": container_name,
            "timestamp": chrono::Utc::now().to_rfc3339()
        });

        let _ = app_handle.emit(&event_name, completed_data);

        Ok(())
    }
}
