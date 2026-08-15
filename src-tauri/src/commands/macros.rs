//! Declarative generators for the per-resource command surface.
//!
//! Before this existed, the ~40 files under `commands/` were byte-identical
//! templates modulo the type name — provably so:
//!
//! ```text
//! diff <(sed 's/Secret/XX/g;s/secret/xx/g' secrets.rs) \
//!      <(sed 's/ConfigMap/XX/g;s/config_map/xx/g' config_maps.rs)   # empty
//! ```
//!
//! ~1,700 lines of copy-paste meant every fix had to be applied 40 times, and in
//! practice wasn't: `deployments.rs` still inlined its own restart/scale patch
//! JSON long after `common::restart_patch()` had been added and adopted by the
//! other workload kinds.
//!
//! ## Why macros rather than one generic command
//!
//! A single `resource_op(kind: String, …)` command would be less code still, but it
//! would change every IPC name and break all 42 files under `src/api/k8s/`. These
//! macros generate exactly the same command names and argument shapes as before, so
//! the wire protocol is untouched and the frontend needs no changes.
//!
//! ## Argument naming
//!
//! `name` is the *context* (cluster) name and `resource_name(s)` is the Kubernetes
//! object name. That is confusing but it is the existing wire contract, so it is
//! preserved verbatim; renaming it is a frontend-coupled change for a later phase.

/// The five commands every namespace-scoped kind needs.
#[macro_export]
macro_rules! k8s_namespaced_commands {
    (
        kind: $kind:ty,
        plural: $plural:literal,
        create: $create:ident,
        update: $update:ident,
        list: $list:ident,
        watch: $watch:ident,
        delete: $delete:ident $(,)?
    ) => {
        #[tauri::command]
        pub async fn $create(
            name: String,
            namespace: Option<String>,
            manifest: ::serde_json::Value,
        ) -> $crate::error::AppResult<::serde_json::Value> {
            $crate::manager::k8s::resources::K8sResources::<$kind>::create(
                name, namespace, manifest,
            )
            .await
        }

        #[tauri::command]
        pub async fn $update(
            name: String,
            namespace: Option<String>,
            manifest: ::serde_json::Value,
        ) -> $crate::error::AppResult<::serde_json::Value> {
            $crate::manager::k8s::resources::K8sResources::<$kind>::update(
                name, namespace, manifest,
            )
            .await
        }

        #[tauri::command]
        pub async fn $list(
            name: String,
            namespaces: Option<Vec<String>>,
        ) -> $crate::error::AppResult<Vec<::serde_json::Value>> {
            $crate::manager::k8s::resources::K8sResources::<$kind>::list(name, namespaces).await
        }

        #[tauri::command]
        pub async fn $watch(
            app_handle: ::tauri::AppHandle,
            name: String,
            namespaces: Option<Vec<String>>,
            state: ::tauri::State<'_, $crate::utils::watcher::WatchManager>,
        ) -> $crate::error::AppResult<String> {
            $crate::commands::common::start_watch(
                app_handle,
                name,
                $plural,
                namespaces,
                state,
                $crate::manager::k8s::resources::K8sResources::<$kind>::watch,
            )
            .await
        }

        #[tauri::command]
        pub async fn $delete(
            name: String,
            namespace: Option<String>,
            resource_names: Vec<String>,
        ) -> $crate::error::AppResult<Vec<Result<String, String>>> {
            $crate::manager::k8s::resources::K8sResources::<$kind>::delete(
                name,
                namespace,
                resource_names,
            )
            .await
        }
    };
}

/// The same five commands for cluster-scoped kinds.
#[macro_export]
macro_rules! k8s_cluster_commands {
    (
        kind: $kind:ty,
        plural: $plural:literal,
        create: $create:ident,
        update: $update:ident,
        list: $list:ident,
        watch: $watch:ident,
        delete: $delete:ident $(,)?
    ) => {
        #[tauri::command]
        pub async fn $create(
            name: String,
            manifest: ::serde_json::Value,
        ) -> $crate::error::AppResult<::serde_json::Value> {
            $crate::manager::k8s::cluster_resources::K8sClusterResources::<$kind>::create(
                name, manifest,
            )
            .await
        }

        #[tauri::command]
        pub async fn $update(
            name: String,
            manifest: ::serde_json::Value,
        ) -> $crate::error::AppResult<::serde_json::Value> {
            $crate::manager::k8s::cluster_resources::K8sClusterResources::<$kind>::update(
                name, manifest,
            )
            .await
        }

        #[tauri::command]
        pub async fn $list(name: String) -> $crate::error::AppResult<Vec<::serde_json::Value>> {
            $crate::manager::k8s::cluster_resources::K8sClusterResources::<$kind>::list(name).await
        }

        #[tauri::command]
        pub async fn $watch(
            app_handle: ::tauri::AppHandle,
            name: String,
            state: ::tauri::State<'_, $crate::utils::watcher::WatchManager>,
        ) -> $crate::error::AppResult<String> {
            $crate::commands::common::start_watch(
                app_handle,
                name,
                $plural,
                None,
                state,
                $crate::manager::k8s::cluster_resources::K8sClusterResources::<$kind>::watch,
            )
            .await
        }

        #[tauri::command]
        pub async fn $delete(
            name: String,
            resource_names: Vec<String>,
        ) -> $crate::error::AppResult<Vec<Result<String, String>>> {
            $crate::manager::k8s::cluster_resources::K8sClusterResources::<$kind>::delete(
                name,
                resource_names,
            )
            .await
        }
    };
}

/// `restart` for workload kinds: bumps a pod-template annotation, which is what
/// `kubectl rollout restart` does.
#[macro_export]
macro_rules! k8s_restart_command {
    (kind: $kind:ty, restart: $restart:ident $(,)?) => {
        #[tauri::command]
        pub async fn $restart(
            name: String,
            namespace: Option<String>,
            resource_name: String,
        ) -> $crate::error::AppResult<::serde_json::Value> {
            $crate::manager::k8s::resources::K8sResources::<$kind>::patch(
                name,
                namespace,
                resource_name,
                $crate::commands::common::restart_patch(),
                "merge".to_string(),
            )
            .await
        }
    };
}

/// `scale` — merge-patches `spec.replicas`.
///
/// Kept separate from `restart` because the two are not always both applicable.
/// KNOWN ISSUE: `daemon_sets.rs` invokes this, and DaemonSets have no
/// `spec.replicas`, so `scale_daemon_set` merge-patches a field that is not in the
/// schema and the apiserver rejects it. That command pre-dates this refactor and is
/// registered in `generate_handler!`, so it is preserved here rather than silently
/// dropped; removing it is a coordinated frontend + backend change.
#[macro_export]
macro_rules! k8s_scale_command {
    (kind: $kind:ty, scale: $scale:ident $(,)?) => {
        #[tauri::command]
        pub async fn $scale(
            name: String,
            namespace: Option<String>,
            resource_name: String,
            replicas: i32,
        ) -> $crate::error::AppResult<::serde_json::Value> {
            $crate::manager::k8s::resources::K8sResources::<$kind>::patch(
                name,
                namespace,
                resource_name,
                $crate::commands::common::scale_patch(replicas),
                "merge".to_string(),
            )
            .await
        }
    };
}

/// `patch` — apply a partial change to one object.
///
/// The right primitive for editing a single field, and strictly safer than `update`:
///
/// * `update` is `Api::replace`, which sends the **whole** object. Ours has already had
///   `managedFields` stripped by the watch layer, so a replace would wipe the
///   apiserver's field-ownership tracking, and it clobbers any concurrent change to a
///   part of the object the user never looked at.
/// * A JSON merge patch touches only the paths it names. Setting a map entry to `null`
///   deletes that entry, which makes add / edit / delete of a single key the same
///   operation.
///
/// Generated per kind rather than as one generic command so the IPC surface stays
/// typed and only kinds that actually need it get a write path.
#[macro_export]
macro_rules! k8s_patch_command {
    (kind: $kind:ty, patch: $patch:ident $(,)?) => {
        #[tauri::command]
        pub async fn $patch(
            name: String,
            namespace: Option<String>,
            resource_name: String,
            patch: ::serde_json::Value,
        ) -> $crate::error::AppResult<::serde_json::Value> {
            $crate::manager::k8s::resources::K8sResources::<$kind>::patch(
                name,
                namespace,
                resource_name,
                patch,
                "merge".to_string(),
            )
            .await
        }
    };
}

/// `suspend` for CronJobs.
#[macro_export]
macro_rules! k8s_suspend_command {
    (kind: $kind:ty, suspend: $suspend:ident $(,)?) => {
        #[tauri::command]
        pub async fn $suspend(
            name: String,
            namespace: Option<String>,
            resource_name: String,
            suspend: bool,
        ) -> $crate::error::AppResult<::serde_json::Value> {
            $crate::manager::k8s::resources::K8sResources::<$kind>::patch(
                name,
                namespace,
                resource_name,
                $crate::commands::common::suspend_patch(suspend),
                "merge".to_string(),
            )
            .await
        }
    };
}
