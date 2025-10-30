use std::{fmt::Debug, pin::Pin};

use futures_util::{future::join_all, Stream, StreamExt};
use k8s_openapi::{
    apimachinery::pkg::apis::meta::v1::ObjectMeta, Metadata, Resource as K8sResource,
};
use kube::{
    api::{Api, DeleteParams, ObjectList, PostParams, WatchEvent, WatchParams},
    core::NamespaceResourceScope,
    Resource,
};
use serde::{de::DeserializeOwned, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Emitter};

use crate::{services::k8s::client::K8sClient, types::event::EventType};

pub struct K8sResources<T> {
    _marker: std::marker::PhantomData<T>,
}

impl<T> K8sResources<T>
where
    T: Clone
        + Debug
        + Resource<DynamicType = (), Scope = NamespaceResourceScope>
        + K8sResource
        + Metadata<Ty = ObjectMeta>
        + DeserializeOwned
        + Serialize
        + Send
        + Sync
        + 'static,
{
    fn get_target_namespaces(namespaces: Option<Vec<String>>) -> Vec<Option<String>> {
        match namespaces {
            Some(v) if !v.is_empty() => v.into_iter().map(Some).collect(),
            _ => vec![None],
        }
    }

    pub async fn create(
        context_name: String,
        namespace: Option<String>,
        manifest: Value,
    ) -> Result<Value, String> {
        let client: kube::Client = K8sClient::for_context(&context_name).await?;
        let api: Api<T> = K8sClient::api::<T>(client, namespace.clone()).await;

        let resource: T = serde_json::from_value(manifest)
            .map_err(|e| format!("Failed to parse resource manifest: {}", e))?;

        let pp: PostParams = PostParams::default();
        let created: T = api
            .create(&pp, &resource)
            .await
            .map_err(|e| Self::extract_error(&e, "create"))?;

        serde_json::to_value(&created).map_err(|e| e.to_string())
    }

    pub async fn list(
        context_name: String,
        namespaces: Option<Vec<String>>,
    ) -> Result<Vec<Value>, String> {
        let client: kube::Client = K8sClient::for_context(&context_name).await?;
        let target_namespaces: Vec<Option<String>> = Self::get_target_namespaces(namespaces);

        let mut all: Vec<Value> = Vec::new();
        for ns in target_namespaces {
            let api: Api<T> = K8sClient::api::<T>(client.clone(), ns).await;
            let list: ObjectList<T> = api
                .list(&Default::default())
                .await
                .map_err(|e| e.to_string())?;
            all.extend(
                list.items
                    .into_iter()
                    .map(|r| serde_json::to_value(&r).unwrap_or(Value::Null)),
            );
        }

        Ok(all)
    }

    pub async fn delete(
        context_name: String,
        namespace: Option<String>,
        names: Vec<String>,
    ) -> Result<Vec<Result<String, String>>, String> {
        let client: kube::Client = K8sClient::for_context(&context_name).await?;

        let futures = names.into_iter().map(|name| {
            let client: kube::Client = client.clone();
            let namespace: Option<String> = namespace.clone();
            async move {
                let api: Api<T> = K8sClient::api::<T>(client, namespace).await;
                let dp: DeleteParams = DeleteParams::default();
                match api.delete(&name, &dp).await {
                    Ok(_) => Ok(name),
                    Err(e) => Err(Self::extract_error(&e, &name)),
                }
            }
        });

        Ok(join_all(futures).await)
    }

    pub async fn watch(
        app_handle: AppHandle,
        context_name: String,
        namespaces: Option<Vec<String>>,
        event_name: String,
    ) -> Result<(), String> {
        let client: kube::Client = K8sClient::for_context(&context_name).await?;
        let target_namespaces: Vec<Option<String>> = Self::get_target_namespaces(namespaces);

        for ns in target_namespaces {
            let api: Api<T> = K8sClient::api::<T>(client.clone(), ns).await;
            let stream: Pin<Box<dyn Stream<Item = Result<WatchEvent<T>, kube::Error>> + Send>> =
                Self::watch_stream(&api).await?;
            Self::spawn_watch(app_handle.clone(), event_name.clone(), stream);
        }

        Ok(())
    }

    async fn watch_stream(
        api: &Api<T>,
    ) -> Result<
        Pin<Box<dyn futures_util::Stream<Item = Result<WatchEvent<T>, kube::Error>> + Send>>,
        String,
    > {
        let wp: WatchParams = WatchParams {
            send_initial_events: true,
            ..Default::default()
        };

        let stream: Pin<Box<dyn Stream<Item = Result<WatchEvent<T>, kube::Error>> + Send>> =
            api.watch(&wp, "").await.map_err(|e| e.to_string())?.boxed();
        Ok(stream)
    }

    fn spawn_watch(
        app_handle: AppHandle,
        event_name: String,
        mut stream: Pin<
            Box<dyn futures_util::Stream<Item = Result<WatchEvent<T>, kube::Error>> + Send>,
        >,
    ) {
        tokio::spawn(async move {
            while let Some(status) = stream.next().await {
                match status {
                    Ok(WatchEvent::Added(obj)) => {
                        Self::emit_event(&app_handle, &event_name, EventType::ADDED, obj)
                    }
                    Ok(WatchEvent::Modified(obj)) => {
                        Self::emit_event(&app_handle, &event_name, EventType::MODIFIED, obj)
                    }
                    Ok(WatchEvent::Deleted(obj)) => {
                        Self::emit_event(&app_handle, &event_name, EventType::DELETED, obj)
                    }
                    Err(e) => eprintln!("Watch error: {}", e),
                    _ => {}
                }
            }
        });
    }

    fn emit_event(app_handle: &AppHandle, event_name: &str, kind: EventType, obj: T) {
        let value = serde_json::to_value(&obj).unwrap_or(Value::Null);
        let event = serde_json::json!({
            "type": kind,
            "object": value,
        });

        let _ = app_handle.emit(event_name, event);
    }

    fn extract_error(e: &kube::Error, name: &str) -> String {
        match e {
            kube::Error::Api(ae) => {
                if ae.message.is_empty() {
                    format!("{}: resource {}", ae.reason, name)
                } else {
                    ae.message.clone()
                }
            }
            other => format!("{}: {}", name, other),
        }
    }
}
