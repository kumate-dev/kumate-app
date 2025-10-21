use std::pin::Pin;

use futures_util::StreamExt;
use k8s_openapi::apimachinery::pkg::apis::meta::v1::Time;
use kube::{
    api::{ObjectMeta, WatchEvent, WatchParams},
    Api, ResourceExt,
};
use serde::de::DeserializeOwned;
use std::fmt::Debug;
use tauri::AppHandle;

use crate::types::event::EventType;

const DEFAULT_NAMESPACE: &str = "default";

pub fn to_namespace(namespace: Option<String>) -> String {
    namespace.unwrap_or(DEFAULT_NAMESPACE.to_string())
}

pub fn to_replicas_ready(replicas: i32, ready: i32) -> String {
    format!("{}/{}", ready, replicas)
}

pub fn to_creation_timestamp(metadata: ObjectMeta) -> Option<String> {
    metadata.creation_timestamp.map(|t: Time| t.0.to_rfc3339())
}

pub fn get_target_namespaces(namespaces: Option<Vec<String>>) -> Vec<Option<String>> {
    match namespaces {
        Some(v) if !v.is_empty() => v.into_iter().map(Some).collect(),
        _ => vec![None],
    }
}
pub fn event_spawn_watch<R, F>(
    app_handle: AppHandle,
    event_name: String,
    mut stream: Pin<
        Box<dyn futures_util::Stream<Item = Result<WatchEvent<R>, kube::Error>> + Send>,
    >,
    emit_fn: F,
) where
    R: ResourceExt + Send + 'static,
    F: Fn(&AppHandle, &str, EventType, R) + Send + Sync + 'static + Clone,
{
    tokio::spawn(async move {
        while let Some(status) = stream.next().await {
            match status {
                Ok(WatchEvent::Added(obj)) => {
                    emit_fn(&app_handle, &event_name, EventType::ADDED, obj)
                }
                Ok(WatchEvent::Modified(obj)) => {
                    emit_fn(&app_handle, &event_name, EventType::MODIFIED, obj)
                }
                Ok(WatchEvent::Deleted(obj)) => {
                    emit_fn(&app_handle, &event_name, EventType::DELETED, obj)
                }
                Err(e) => eprintln!("Watch error: {}", e),
                _ => {}
            }
        }
    });
}

pub async fn watch_stream<R>(
    api: &Api<R>,
) -> Result<
    Pin<Box<dyn futures_util::Stream<Item = Result<WatchEvent<R>, kube::Error>> + Send>>,
    String,
>
where
    R: kube::Resource + Clone + Debug + DeserializeOwned + Send + Sync + 'static,
{
    let wp: WatchParams = WatchParams {
        send_initial_events: true,
        ..Default::default()
    };

    let stream = api.watch(&wp, "").await.map_err(|e| e.to_string())?.boxed();
    Ok(stream)
}
