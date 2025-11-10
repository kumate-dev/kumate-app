use std::pin::Pin;

use futures_util::{Stream, StreamExt};
use kube::api::{Api, ApiResource, DeleteParams, ObjectList, PostParams, WatchEvent, WatchParams};
use kube::core::gvk::GroupVersionKind;
use kube::Client;
use serde_json::Value;
use tauri::{AppHandle, Emitter};

use crate::{manager::k8s::client::K8sClient, types::event::EventType};

/// Generic dynamic manager to operate on Custom Resources (CRDs) without fixed types.
pub struct DynamicK8sResources;

impl DynamicK8sResources {
    fn api_resource(group: &str, version: &str, kind: &str, plural: &str) -> ApiResource {
        let gvk: GroupVersionKind = GroupVersionKind::gvk(group, version, kind);
        let mut ar = ApiResource::from_gvk(&gvk);
        // Plural is required to construct the correct endpoint path
        ar.plural = plural.to_string();
        ar
    }

    async fn make_api(
        client: Client,
        namespace: Option<String>,
        group: &str,
        version: &str,
        kind: &str,
        plural: &str,
        is_namespaced: bool,
    ) -> Api<kube::api::DynamicObject> {
        let ar: ApiResource = Self::api_resource(group, version, kind, plural);
        match (is_namespaced, namespace.as_ref()) {
            // Cluster-scoped resource
            (false, _) => Api::all_with(client, &ar),
            // Namespaced resource with explicit namespace
            (true, Some(ns)) => Api::namespaced_with(client, ns, &ar),
            // Namespaced resource across all namespaces
            (true, None) => Api::all_with(client, &ar),
        }
    }

    pub async fn create(
        context_name: String,
        namespace: Option<String>,
        group: String,
        version: String,
        kind: String,
        plural: String,
        is_namespaced: bool,
        manifest: Value,
    ) -> Result<Value, String> {
        let client: kube::Client = K8sClient::for_context(&context_name).await?;
        let api = Self::make_api(
            client,
            namespace.clone(),
            &group,
            &version,
            &kind,
            &plural,
            is_namespaced,
        )
        .await;

        let obj: kube::api::DynamicObject = serde_json::from_value(manifest)
            .map_err(|e| format!("Failed to parse resource manifest: {}", e))?;

        let pp: PostParams = PostParams::default();
        let created = api.create(&pp, &obj).await.map_err(|e| Self::extract_error(&e, "create"))?;
        serde_json::to_value(&created).map_err(|e| e.to_string())
    }

    pub async fn update(
        context_name: String,
        namespace: Option<String>,
        group: String,
        version: String,
        kind: String,
        plural: String,
        is_namespaced: bool,
        manifest: Value,
    ) -> Result<Value, String> {
        let client: kube::Client = K8sClient::for_context(&context_name).await?;
        let api = Self::make_api(
            client,
            namespace.clone(),
            &group,
            &version,
            &kind,
            &plural,
            is_namespaced,
        )
        .await;

        let obj: kube::api::DynamicObject = serde_json::from_value(manifest)
            .map_err(|e| format!("Failed to parse resource manifest: {}", e))?;
        let name: String = obj
            .metadata
            .name
            .clone()
            .ok_or_else(|| "Missing metadata.name for resource update".to_string())?;
        let pp: PostParams = PostParams::default();
        let updated =
            api.replace(&name, &pp, &obj).await.map_err(|e| Self::extract_error(&e, "update"))?;
        serde_json::to_value(&updated).map_err(|e| e.to_string())
    }

    pub async fn list(
        context_name: String,
        namespaces: Option<Vec<String>>,
        group: String,
        version: String,
        kind: String,
        plural: String,
        is_namespaced: bool,
    ) -> Result<Vec<Value>, String> {
        let client: kube::Client = K8sClient::for_context(&context_name).await?;

        let target_namespaces: Vec<Option<String>> = match namespaces {
            Some(v) if !v.is_empty() && is_namespaced => v.into_iter().map(Some).collect(),
            _ => vec![None],
        };

        let mut out: Vec<Value> = Vec::new();
        for ns in target_namespaces {
            let api = Self::make_api(
                client.clone(),
                ns.clone(),
                &group,
                &version,
                &kind,
                &plural,
                is_namespaced,
            )
            .await;

            let list: ObjectList<kube::api::DynamicObject> =
                api.list(&Default::default()).await.map_err(|e| Self::extract_error(&e, "list"))?;

            out.extend(
                list.items.into_iter().map(|r| serde_json::to_value(&r).unwrap_or(Value::Null)),
            );
        }

        Ok(out)
    }

    pub async fn delete(
        context_name: String,
        namespace: Option<String>,
        group: String,
        version: String,
        kind: String,
        plural: String,
        is_namespaced: bool,
        resource_names: Vec<String>,
    ) -> Result<Vec<Result<String, String>>, String> {
        let client: kube::Client = K8sClient::for_context(&context_name).await?;
        let api =
            Self::make_api(client, namespace, &group, &version, &kind, &plural, is_namespaced)
                .await;

        let dp: DeleteParams = DeleteParams::default();
        let mut results: Vec<Result<String, String>> = Vec::new();
        for name in resource_names {
            match api.delete(&name, &dp).await {
                Ok(_) => results.push(Ok(name)),
                Err(e) => results.push(Err(Self::extract_error(&e, "delete"))),
            }
        }
        Ok(results)
    }

    pub async fn watch(
        app_handle: AppHandle,
        context_name: String,
        namespaces: Option<Vec<String>>,
        group: String,
        version: String,
        kind: String,
        plural: String,
        is_namespaced: bool,
        event_name: String,
    ) -> Result<(), String> {
        let client: kube::Client = K8sClient::for_context(&context_name).await?;
        let target_namespaces: Vec<Option<String>> = match namespaces {
            Some(v) if !v.is_empty() && is_namespaced => v.into_iter().map(Some).collect(),
            _ => vec![None],
        };

        for ns in target_namespaces {
            let api =
                Self::make_api(client.clone(), ns, &group, &version, &kind, &plural, is_namespaced)
                    .await;
            let stream: Pin<
                Box<
                    dyn Stream<Item = Result<WatchEvent<kube::api::DynamicObject>, kube::Error>>
                        + Send,
                >,
            > = Self::watch_stream(&api).await?;
            Self::spawn_watch(app_handle.clone(), event_name.clone(), stream);
        }
        Ok(())
    }

    async fn watch_stream(
        api: &Api<kube::api::DynamicObject>,
    ) -> Result<
        Pin<
            Box<
                dyn futures_util::Stream<
                        Item = Result<WatchEvent<kube::api::DynamicObject>, kube::Error>,
                    > + Send,
            >,
        >,
        String,
    > {
        // Try to request initial events; if the API server forbids it, retry without.
        let with_initial: WatchParams = WatchParams {
            send_initial_events: true,
            ..Default::default()
        };
        match api.watch(&with_initial, "").await {
            Ok(stream) => Ok(stream.boxed()),
            Err(err) => {
                let needs_fallback = match &err {
                    kube::Error::Api(ae) => {
                        let m = ae.message.to_lowercase();
                        m.contains("sendinitialevents")
                            || m.contains("forbidden")
                            || ae.reason == "Invalid"
                    }
                    _ => false,
                };

                if needs_fallback {
                    let default_wp: WatchParams = Default::default();
                    api.watch(&default_wp, "").await.map(|s| s.boxed()).map_err(|e| e.to_string())
                } else {
                    Err(err.to_string())
                }
            }
        }
    }

    fn spawn_watch(
        app_handle: AppHandle,
        event_name: String,
        mut stream: Pin<
            Box<
                dyn Stream<Item = Result<WatchEvent<kube::api::DynamicObject>, kube::Error>> + Send,
            >,
        >,
    ) {
        tauri::async_runtime::spawn(async move {
            while let Some(next) = stream.next().await {
                match next {
                    Ok(WatchEvent::Added(obj)) => {
                        Self::emit_event(&app_handle, &event_name, EventType::ADDED, obj)
                    }
                    Ok(WatchEvent::Modified(obj)) => {
                        Self::emit_event(&app_handle, &event_name, EventType::MODIFIED, obj)
                    }
                    Ok(WatchEvent::Deleted(obj)) => {
                        Self::emit_event(&app_handle, &event_name, EventType::DELETED, obj)
                    }
                    Ok(_) => {}
                    Err(e) => {
                        let _ = app_handle.emit(
                            &event_name,
                            serde_json::json!({
                                "type": "ERROR",
                                "message": e.to_string(),
                            }),
                        );
                    }
                }
            }
        });
    }

    fn emit_event(
        app_handle: &AppHandle,
        event_name: &str,
        kind: EventType,
        obj: kube::api::DynamicObject,
    ) {
        let value: Value = serde_json::to_value(&obj).unwrap_or(Value::Null);
        let event: Value = serde_json::json!({
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
