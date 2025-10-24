use futures_util::{future::join_all, StreamExt};
use k8s_openapi::{apimachinery::pkg::apis::meta::v1::Time, Resource};
use kube::{
    api::{Api, DeleteParams, ObjectMeta, WatchEvent, WatchParams},
    Client, ResourceExt,
};
use serde::{de::DeserializeOwned, Serialize};
use std::fmt::Debug;
use std::{future::Future, pin::Pin};
use tauri::{AppHandle, Emitter};

use crate::{k8s::client::K8sClient, types::event::EventType};

pub struct K8sCommon;

impl K8sCommon {
    const DEFAULT_NAMESPACE: &'static str = "default";

    pub fn to_namespace(namespace: Option<String>) -> String {
        namespace.unwrap_or(Self::DEFAULT_NAMESPACE.to_string())
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

    pub async fn list_resources<R, F, T>(
        context_name: &str,
        namespaces: Option<Vec<String>>,
        fetch_fn: F,
    ) -> Result<Vec<T>, String>
    where
        R: Resource + Clone + Debug + DeserializeOwned + Send + Sync + 'static,
        F: Fn(
                Client,
                Option<String>,
            ) -> Pin<Box<dyn Future<Output = Result<Vec<R>, String>> + Send>>
            + Send
            + Sync,
        T: Send + 'static,
        for<'a> &'a R: Into<T>,
    {
        let client: Client = K8sClient::for_context(context_name).await?;
        let target_namespaces: Vec<Option<String>> = Self::get_target_namespaces(namespaces);

        let results: Vec<Result<Vec<R>, String>> = join_all(
            target_namespaces
                .into_iter()
                .map(|ns| fetch_fn(client.clone(), ns)),
        )
        .await;

        let all: Vec<T> = results
            .into_iter()
            .collect::<Result<Vec<_>, _>>()?
            .into_iter()
            .flatten()
            .map(|r| (&r).into())
            .collect();

        Ok(all)
    }

    pub async fn list_cluster_resources<R, F, T, M>(
        context_name: &str,
        fetch_fn: F,
        map_fn: M,
    ) -> Result<Vec<T>, String>
    where
        R: Resource + Clone + Debug + DeserializeOwned + Send + Sync + 'static,
        F: Fn(Client) -> Pin<Box<dyn Future<Output = Result<Vec<R>, String>> + Send>> + Send + Sync,
        M: Fn(R) -> T + Send + Sync + Clone + 'static,
    {
        let client = K8sClient::for_context(context_name).await?;
        let resources = fetch_fn(client).await?;
        Ok(resources.into_iter().map(map_fn).collect())
    }

    pub async fn delete_resources<R, F, Fut>(
        context_name: &str,
        namespace: Option<String>,
        names: Vec<String>,
        api_fn: F,
    ) -> Result<Vec<Result<String, String>>, String>
    where
        R: Resource + Clone + Send + Sync + 'static + DeserializeOwned + Debug,
        F: Fn(Client, Option<String>) -> Fut + Send + Sync + Copy,
        Fut: Future<Output = Api<R>> + Send,
    {
        let client: Client = K8sClient::for_context(context_name)
            .await
            .map_err(|e| e.to_string())?;

        let futures = names.into_iter().map(|name| {
            let client: Client = client.clone();
            let namespace: Option<String> = namespace.clone();
            let api_fn = api_fn;
            async move {
                let api: Api<R> = api_fn(client, namespace).await;
                let dp: DeleteParams = DeleteParams::default();
                match api.delete(&name, &dp).await {
                    Ok(_) => Ok(name.clone()),
                    Err(e) => Err(Self::extract_error(&e, &name)),
                }
            }
        });

        let results: Vec<Result<String, String>> = join_all(futures).await;
        Ok(results)
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

    pub fn emit_event<T, U>(
        app_handle: &tauri::AppHandle,
        event_name: &str,
        kind: EventType,
        obj: T,
    ) where
        T: Into<U>,
        U: Serialize + Clone + From<T>,
    {
        let event = serde_json::json!({
            "type": kind,
            "object": obj.into(),
        });

        let _ = app_handle.emit(event_name, event);
    }

    fn extract_error(e: &kube::Error, name: &str) -> String {
        match e {
            kube::Error::Api(ae) => {
                if ae.message.is_empty() {
                    format!("{}: resource {}", ae.reason, name)
                } else {
                    format!("{}", ae.message)
                }
            }
            other => format!("{}: {}", name, other),
        }
    }
}
