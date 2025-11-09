use std::{fmt::Debug, pin::Pin};

use futures_util::{future::join_all, Stream, StreamExt};
use k8s_openapi::{
    apimachinery::pkg::apis::meta::v1::ObjectMeta, Metadata, Resource as K8sResource,
};
use kube::{
    api::{Api, DeleteParams, ListParams, ObjectList, PostParams, WatchEvent, WatchParams},
    Resource,
};
use serde::{de::DeserializeOwned, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Emitter};

use crate::{manager::k8s::client::K8sClient, types::event::EventType};

pub struct K8sClusterResources<T> {
    _marker: std::marker::PhantomData<T>,
}

impl<T> K8sClusterResources<T>
where
    T: Clone
        + Debug
        + Resource
        + K8sResource
        + Metadata<Ty = ObjectMeta>
        + DeserializeOwned
        + Serialize
        + Send
        + Sync
        + 'static,
    <T as Resource>::DynamicType: Default,
{
    pub async fn create(context_name: String, manifest: Value) -> Result<Value, String> {
        let client: kube::Client = K8sClient::for_context(&context_name).await?;
        let api: Api<T> = Api::all(client);
        let obj: T = serde_json::from_value(manifest).map_err(|e| e.to_string())?;
        let pp: PostParams = PostParams::default();
        let created: T = api.create(&pp, &obj).await.map_err(|e| e.to_string())?;
        Ok(serde_json::to_value(created).unwrap_or(Value::Null))
    }

    pub async fn update(context_name: String, manifest: Value) -> Result<Value, String> {
        let client: kube::Client = K8sClient::for_context(&context_name).await?;
        let api: Api<T> = Api::all(client);
        let obj: T = serde_json::from_value(manifest.clone()).map_err(|e| e.to_string())?;
        let name: String = obj
            .metadata()
            .name
            .clone()
            .ok_or_else(|| "Missing metadata.name for resource update".to_string())?;
        let pp: PostParams = PostParams::default();
        let updated: T = api.replace(&name, &pp, &obj).await.map_err(|e| e.to_string())?;
        Ok(serde_json::to_value(updated).unwrap_or(Value::Null))
    }

    pub async fn list(context_name: String) -> Result<Vec<Value>, String> {
        let client: kube::Client = K8sClient::for_context(&context_name).await?;
        let api: Api<T> = Api::all(client);
        let list: ObjectList<T> = api.list(&Default::default()).await.map_err(|e| e.to_string())?;

        Ok(list
            .items
            .into_iter()
            .map(|r| serde_json::to_value(&r).unwrap_or(Value::Null))
            .collect())
    }

    pub async fn list_with_fields(
        context_name: String,
        field_selector: Option<String>,
    ) -> Result<Vec<Value>, String> {
        let client: kube::Client = K8sClient::for_context(&context_name).await?;
        let api: Api<T> = Api::all(client);
        let lp: ListParams = ListParams {
            field_selector,
            ..Default::default()
        };
        let list: ObjectList<T> = api.list(&lp).await.map_err(|e| e.to_string())?;

        Ok(list
            .items
            .into_iter()
            .map(|r| serde_json::to_value(&r).unwrap_or(Value::Null))
            .collect())
    }

    pub async fn delete(
        context_name: String,
        names: Vec<String>,
    ) -> Result<Vec<Result<String, String>>, String> {
        let client: kube::Client = K8sClient::for_context(&context_name).await?;
        let api: Api<T> = Api::all(client);

        let futures = names.into_iter().map(|name| {
            let api = api.clone();
            async move {
                let dp: DeleteParams = DeleteParams::default();
                match api.delete(&name, &dp).await {
                    Ok(_) => Ok(name),
                    Err(e) => Err(e.to_string()),
                }
            }
        });

        Ok(join_all(futures).await)
    }

    pub async fn watch(
        app_handle: AppHandle,
        context_name: String,
        event_name: String,
    ) -> Result<(), String> {
        let client: kube::Client = K8sClient::for_context(&context_name).await?;
        let api: Api<T> = Api::all(client);
        let stream: Pin<Box<dyn Stream<Item = Result<WatchEvent<T>, kube::Error>> + Send>> =
            Self::watch_stream(&api).await?;
        Self::spawn_watch(app_handle, event_name, stream);
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
        let value: Value = serde_json::to_value(&obj).unwrap_or(Value::Null);
        let event: Value = serde_json::json!({
            "type": kind,
            "object": value,
        });

        let _ = app_handle.emit(event_name, event);
    }
}
