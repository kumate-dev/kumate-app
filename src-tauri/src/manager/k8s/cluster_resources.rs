//! Generic CRUD + watch for cluster-scoped, statically typed resources.
//!
//! The namespace-scoped twin is [`super::resources`]; CRDs and other dynamic kinds
//! use [`super::dynamic_resources`]. All three now share one watch driver
//! ([`super::watch_loop`]) instead of carrying verbatim copies of it — this file
//! previously held its own `watch_stream`/`spawn_watch`/`emit_event` trio that was
//! byte-identical to the other two.

use std::fmt::Debug;

use futures_util::future::join_all;
use k8s_openapi::{
    apimachinery::pkg::apis::meta::v1::ObjectMeta, Metadata, Resource as K8sResource,
};
use kube::{
    api::{Api, DeleteParams, ListParams, ObjectList, PostParams},
    Resource,
};
use serde::{de::DeserializeOwned, Serialize};
use serde_json::Value;
use tauri::AppHandle;
use tokio_util::sync::CancellationToken;

use crate::error::{AppError, AppResult};
use crate::manager::k8s::{client::K8sClient, watch_loop};

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
    /// Cluster-scoped kinds have exactly one endpoint, so there is nothing to fan
    /// out over: every call site funnels through `Api::all`.
    async fn api(context_name: &str) -> AppResult<Api<T>> {
        let client = K8sClient::for_context(context_name).await?;
        Ok(Api::all(client))
    }

    // /// Patch a cluster-scoped object.
    // ///
    // /// `namespace` is accepted and ignored so this mirrors
    // /// [`super::resources::K8sResources::patch`] parameter-for-parameter; callers
    // /// (and the command macros) can therefore treat the two managers
    // /// interchangeably. Cluster-scoped objects have no namespace to honour.
    // pub async fn patch(
    //     context_name: String,
    //     _namespace: Option<String>,
    //     resource_name: String,
    //     patch: Value,
    //     patch_type: String,
    // ) -> AppResult<Value> {
    //     let api = Self::api(&context_name).await?;
    //     let params = PatchParams::default();

    //     let result: T = match patch_type.as_str() {
    //         "strategic" => {
    //             api.patch(&resource_name, &params, &Patch::Strategic(patch))
    //                 .await
    //         }
    //         // Merge is the safe default for anything we do not explicitly recognise.
    //         _ => {
    //             api.patch(&resource_name, &params, &Patch::Merge(patch))
    //                 .await
    //         }
    //     }
    //     .map_err(|e| AppError::from_kube(&e, &resource_name))?;

    //     Ok(serde_json::to_value(&result)?)
    // }

    /// Create, or replace an existing object.
    ///
    /// NOTE: `is_apply` uses `replace`, which is a full overwrite and will clobber
    /// concurrent changes made by other clients. Server-side apply would be the
    /// correct primitive here; it is deliberately left as follow-up work because
    /// switching changes field-ownership semantics for every kind at once.
    async fn upsert(context_name: String, manifest: Value, is_apply: bool) -> AppResult<Value> {
        let api = Self::api(&context_name).await?;

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

    pub async fn create(context_name: String, manifest: Value) -> AppResult<Value> {
        Self::upsert(context_name, manifest, false).await
    }

    pub async fn update(context_name: String, manifest: Value) -> AppResult<Value> {
        Self::upsert(context_name, manifest, true).await
    }

    pub async fn list(context_name: String) -> AppResult<Vec<Value>> {
        let api = Self::api(&context_name).await?;
        let list: ObjectList<T> = api
            .list(&ListParams::default())
            .await
            .map_err(|e| AppError::from_kube(&e, "list"))?;

        let mut all: Vec<Value> = Vec::with_capacity(list.items.len());
        for mut item in list.items {
            // Same rationale as the watch path: managedFields is never rendered,
            // is frequently the largest part of an object, and dropping it here
            // shrinks the IPC payload. A serialization failure is now propagated
            // instead of being turned into a `null` row the UI could not explain.
            kube::ResourceExt::managed_fields_mut(&mut item).clear();
            all.push(serde_json::to_value(&item)?);
        }

        Ok(all)
    }

    /// Drive the watch until `cancel` fires.
    ///
    /// `namespaces` is always `None` for cluster scope. It exists only so this
    /// function has the same shape as the namespaced watch that
    /// `commands::common::start_watch` is generic over.
    ///
    /// The stream is driven concurrently *by the caller's task* and deliberately
    /// not `tokio::spawn`ed: the previous implementation spawned it and kept no
    /// handle, so `unwatch` aborted only the parent — which had already returned —
    /// and the stream leaked for the life of the process.
    pub async fn watch(
        app_handle: AppHandle,
        context_name: String,
        _namespaces: Option<Vec<String>>,
        event_name: String,
        cancel: CancellationToken,
    ) -> AppResult<()> {
        let api = Self::api(&context_name).await?;

        // Exactly one target for cluster scope, but kept in the same
        // build-then-`join_all` shape as `resources::watch` so the two stay
        // trivially comparable.
        let streams = vec![watch_loop::run(
            app_handle, event_name,
            // Cluster-scoped objects are not namespaced, so the store shard for
            // this watch is keyed with `None`.
            None, api, cancel,
        )];

        join_all(streams).await;
        Ok(())
    }

    pub async fn delete(
        context_name: String,
        names: Vec<String>,
    ) -> AppResult<Vec<Result<String, String>>> {
        let api = Self::api(&context_name).await?;

        let futures = names.into_iter().map(|name| {
            let api = api.clone();
            async move {
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
