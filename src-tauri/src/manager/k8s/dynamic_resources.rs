//! CRUD + watch for dynamically typed resources (CRDs and anything else we do not
//! have a compile-time Rust type for).
//!
//! Statically typed kinds go through [`super::resources`] (namespaced) or
//! [`super::cluster_resources`] (cluster-scoped). All three now share one watch
//! driver ([`super::watch_loop`]); this file used to carry its own verbatim copy of
//! `watch_stream`/`spawn_watch`/`emit_event`.

use futures_util::future::join_all;
use kube::api::{Api, ApiResource, DeleteParams, ListParams, ObjectList, PostParams};
use kube::core::gvk::GroupVersionKind;
use kube::Client;
use serde_json::Value;
use tauri::AppHandle;
use tokio_util::sync::CancellationToken;

use crate::error::{AppError, AppResult};
use crate::manager::k8s::{client::K8sClient, watch_loop};

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

    /// Which endpoints a list/watch should fan out over.
    ///
    /// `None` means "all namespaces" (a single cluster-wide request). A
    /// cluster-scoped kind always collapses to one target regardless of what the UI
    /// sent for `namespaces`.
    fn target_namespaces(
        namespaces: Option<Vec<String>>,
        is_namespaced: bool,
    ) -> Vec<Option<String>> {
        match namespaces {
            Some(v) if !v.is_empty() && is_namespaced => v.into_iter().map(Some).collect(),
            _ => vec![None],
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
    ) -> AppResult<Value> {
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
            .map_err(|e| AppError::invalid(format!("could not parse manifest: {e}")))?;

        let pp: PostParams = PostParams::default();
        let created = api
            .create(&pp, &obj)
            .await
            .map_err(|e| AppError::from_kube(&e, "create"))?;
        Ok(serde_json::to_value(&created)?)
    }

    /// Replace an existing object.
    ///
    /// NOTE: `replace` is a full overwrite and will clobber concurrent changes made
    /// by other clients. Server-side apply would be the correct primitive; it is
    /// left as follow-up work because it changes field-ownership semantics.
    pub async fn update(
        context_name: String,
        namespace: Option<String>,
        group: String,
        version: String,
        kind: String,
        plural: String,
        is_namespaced: bool,
        manifest: Value,
    ) -> AppResult<Value> {
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
            .map_err(|e| AppError::invalid(format!("could not parse manifest: {e}")))?;
        let name: String = obj
            .metadata
            .name
            .clone()
            .ok_or_else(|| AppError::invalid("manifest is missing metadata.name"))?;
        let pp: PostParams = PostParams::default();
        let updated = api
            .replace(&name, &pp, &obj)
            .await
            .map_err(|e| AppError::from_kube(&e, &name))?;
        Ok(serde_json::to_value(&updated)?)
    }

    pub async fn list(
        context_name: String,
        namespaces: Option<Vec<String>>,
        group: String,
        version: String,
        kind: String,
        plural: String,
        is_namespaced: bool,
    ) -> AppResult<Vec<Value>> {
        let client: kube::Client = K8sClient::for_context(&context_name).await?;
        let target_namespaces = Self::target_namespaces(namespaces, is_namespaced);

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

            let list: ObjectList<kube::api::DynamicObject> = api
                .list(&ListParams::default())
                .await
                .map_err(|e| AppError::from_kube(&e, "list"))?;

            for mut item in list.items {
                // Same rationale as the watch path: managedFields is never
                // rendered, is frequently the largest part of an object, and
                // dropping it here shrinks the IPC payload. A serialization
                // failure is now propagated instead of being turned into a `null`
                // row the UI could not explain.
                kube::ResourceExt::managed_fields_mut(&mut item).clear();
                out.push(serde_json::to_value(&item)?);
            }
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
    ) -> AppResult<Vec<Result<String, String>>> {
        let client: kube::Client = K8sClient::for_context(&context_name).await?;
        let api = Self::make_api(
            client,
            namespace,
            &group,
            &version,
            &kind,
            &plural,
            is_namespaced,
        )
        .await;

        let dp: DeleteParams = DeleteParams::default();
        let mut results: Vec<Result<String, String>> = Vec::new();
        for name in resource_names {
            match api.delete(&name, &dp).await {
                Ok(_) => results.push(Ok(name)),
                // Kept as a plain string so the per-item wire format the UI
                // already parses stays unchanged.
                Err(e) => results.push(Err(AppError::from_kube(&e, &name).to_string())),
            }
        }
        Ok(results)
    }

    /// Drive watches for every selected namespace until `cancel` fires.
    ///
    /// All namespace streams are driven concurrently *by the caller's task*. They
    /// are deliberately not `tokio::spawn`ed / `tauri::async_runtime::spawn`ed: the
    /// previous implementation spawned them and kept no handles, so `unwatch`
    /// aborted only the parent — which had already returned — and every namespace
    /// stream leaked for the life of the process.
    ///
    /// The old code also emitted a `{"type":"ERROR"}` event on stream failure and
    /// then exited the loop. [`watch_loop`] recovers from errors (backoff + relist)
    /// instead of terminating, so there is no longer a terminal condition worth
    /// reporting to the UI; the error is logged instead.
    #[allow(clippy::too_many_arguments)]
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
        cancel: CancellationToken,
    ) -> AppResult<()> {
        let client: kube::Client = K8sClient::for_context(&context_name).await?;
        let target_namespaces = Self::target_namespaces(namespaces, is_namespaced);

        let mut streams = Vec::with_capacity(target_namespaces.len());
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
}
