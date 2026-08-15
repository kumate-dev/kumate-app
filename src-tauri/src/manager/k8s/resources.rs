//! Generic CRUD + watch for namespace-scoped, statically typed resources.
//!
//! Cluster-scoped kinds use [`super::cluster_resources`]; CRDs and other dynamic
//! kinds use [`super::dynamic_resources`]. All three now share one watch driver
//! ([`super::watch_loop`]) instead of carrying verbatim copies of it.

use std::fmt::Debug;

use futures_util::future::join_all;
use k8s_openapi::{
    apimachinery::pkg::apis::meta::v1::ObjectMeta, Metadata, Resource as K8sResource,
};
use kube::{
    api::{Api, DeleteParams, ListParams, ObjectList, Patch, PatchParams, PostParams},
    core::NamespaceResourceScope,
    Resource,
};
use serde::{de::DeserializeOwned, Serialize};
use serde_json::Value;
use tauri::AppHandle;
use tokio_util::sync::CancellationToken;

use crate::error::{AppError, AppResult};
use crate::manager::k8s::{client::K8sClient, watch_loop};

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
    /// `None` means "all namespaces" and maps to a single cluster-wide `Api::all`.
    fn get_target_namespaces(namespaces: Option<Vec<String>>) -> Vec<Option<String>> {
        match namespaces {
            Some(v) if !v.is_empty() => v.into_iter().map(Some).collect(),
            _ => vec![None],
        }
    }

    pub async fn patch(
        context_name: String,
        namespace: Option<String>,
        resource_name: String,
        patch: Value,
        patch_type: String,
    ) -> AppResult<Value> {
        let client = K8sClient::for_context(&context_name).await?;
        let api: Api<T> = K8sClient::api::<T>(client, namespace).await;
        let params = PatchParams::default();

        let result: T = match patch_type.as_str() {
            "strategic" => {
                api.patch(&resource_name, &params, &Patch::Strategic(patch))
                    .await
            }
            // Merge is the safe default for anything we do not explicitly recognise.
            _ => {
                api.patch(&resource_name, &params, &Patch::Merge(patch))
                    .await
            }
        }
        .map_err(|e| AppError::from_kube(&e, &resource_name))?;

        Ok(serde_json::to_value(&result)?)
    }

    /// Create, or replace an existing object.
    ///
    /// NOTE: `is_apply` uses `replace`, which is a full overwrite and will clobber
    /// concurrent changes made by other clients. Server-side apply would be the
    /// correct primitive here; it is deliberately left as follow-up work because
    /// switching changes field-ownership semantics for every kind at once.
    async fn upsert(
        context_name: String,
        namespace: Option<String>,
        manifest: Value,
        is_apply: bool,
    ) -> AppResult<Value> {
        let client = K8sClient::for_context(&context_name).await?;
        let api: Api<T> = K8sClient::api::<T>(client, namespace).await;

        let resource: T = serde_json::from_value(manifest)
            .map_err(|e| AppError::invalid(format!("could not parse manifest: {e}")))?;

        let pp = PostParams::default();

        let result = if is_apply {
            let name = resource
                .metadata()
                .name
                .clone()
                .ok_or_else(|| AppError::invalid("manifest is missing metadata.name"))?;

            api.replace(&name, &pp, &resource)
                .await
                .map_err(|e| AppError::from_kube(&e, &name))?
        } else {
            api.create(&pp, &resource)
                .await
                .map_err(|e| AppError::from_kube(&e, "create"))?
        };

        Ok(serde_json::to_value(&result)?)
    }

    pub async fn create(
        context_name: String,
        namespace: Option<String>,
        manifest: Value,
    ) -> AppResult<Value> {
        Self::upsert(context_name, namespace, manifest, false).await
    }

    pub async fn update(
        context_name: String,
        namespace: Option<String>,
        manifest: Value,
    ) -> AppResult<Value> {
        Self::upsert(context_name, namespace, manifest, true).await
    }

    pub async fn list(
        context_name: String,
        namespaces: Option<Vec<String>>,
    ) -> AppResult<Vec<Value>> {
        Self::list_with_fields(context_name, namespaces, None).await
    }

    pub async fn list_with_fields(
        context_name: String,
        namespaces: Option<Vec<String>>,
        field_selector: Option<String>,
    ) -> AppResult<Vec<Value>> {
        let client = K8sClient::for_context(&context_name).await?;
        let target_namespaces = Self::get_target_namespaces(namespaces);

        let mut all: Vec<Value> = Vec::new();
        for ns in target_namespaces {
            let api: Api<T> = K8sClient::api::<T>(client.clone(), ns).await;
            let lp = ListParams {
                field_selector: field_selector.clone(),
                ..Default::default()
            };
            let list: ObjectList<T> = api
                .list(&lp)
                .await
                .map_err(|e| AppError::from_kube(&e, "list"))?;

            for mut item in list.items {
                // Same rationale as the watch path: managedFields is never rendered
                // and is often the bulk of the payload.
                kube::ResourceExt::managed_fields_mut(&mut item).clear();
                all.push(serde_json::to_value(&item)?);
            }
        }

        Ok(all)
    }

    /// Drive watches for every selected namespace until `cancel` fires.
    ///
    /// All namespace streams are driven concurrently *by the caller's task*. They are
    /// deliberately not `tokio::spawn`ed: the previous implementation spawned them
    /// and kept no handles, so `unwatch` aborted only the parent — which had already
    /// returned — and every namespace stream leaked for the life of the process.
    pub async fn watch(
        app_handle: AppHandle,
        context_name: String,
        namespaces: Option<Vec<String>>,
        event_name: String,
        cancel: CancellationToken,
    ) -> AppResult<()> {
        let client = K8sClient::for_context(&context_name).await?;
        let target_namespaces = Self::get_target_namespaces(namespaces);

        let mut streams = Vec::with_capacity(target_namespaces.len());
        for ns in target_namespaces {
            let api: Api<T> = K8sClient::api::<T>(client.clone(), ns.clone()).await;
            streams.push(watch_loop::run(
                app_handle.clone(),
                event_name.clone(),
                ns,
                api,
                cancel.clone(),
            ));
        }

        join_all(streams).await;
        Ok(())
    }

    pub async fn delete(
        context_name: String,
        namespace: Option<String>,
        names: Vec<String>,
    ) -> AppResult<Vec<Result<String, String>>> {
        let client = K8sClient::for_context(&context_name).await?;

        let futures = names.into_iter().map(|name| {
            let client = client.clone();
            let namespace = namespace.clone();
            async move {
                let api: Api<T> = K8sClient::api::<T>(client, namespace).await;
                match api.delete(&name, &DeleteParams::default()).await {
                    Ok(_) => Ok(name),
                    // Kept as a plain string so the per-item wire format the UI
                    // already parses stays unchanged.
                    Err(e) => Err(AppError::from_kube(&e, &name).to_string()),
                }
            }
        });

        Ok(join_all(futures).await)
    }
}
