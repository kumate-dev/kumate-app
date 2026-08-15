//! Custom resource (CRD instance) commands.
//!
//! Not macro-generated: every call carries the GVK + plural + scope at runtime,
//! since the kind is not known at compile time.

use crate::commands::common::start_watch;
use crate::error::AppResult;
use crate::manager::k8s::dynamic_resources::DynamicK8sResources;
use crate::utils::watcher::WatchManager;
use serde_json::Value;
use tauri::AppHandle;

#[tauri::command]
pub async fn create_custom_resource(
    name: String,
    namespace: Option<String>,
    group: String,
    version: String,
    kind: String,
    plural: String,
    is_namespaced: bool,
    manifest: Value,
) -> AppResult<Value> {
    DynamicK8sResources::create(
        name,
        namespace,
        group,
        version,
        kind,
        plural,
        is_namespaced,
        manifest,
    )
    .await
}

#[tauri::command]
pub async fn update_custom_resource(
    name: String,
    namespace: Option<String>,
    group: String,
    version: String,
    kind: String,
    plural: String,
    is_namespaced: bool,
    manifest: Value,
) -> AppResult<Value> {
    DynamicK8sResources::update(
        name,
        namespace,
        group,
        version,
        kind,
        plural,
        is_namespaced,
        manifest,
    )
    .await
}

#[tauri::command]
pub async fn list_custom_resources(
    name: String,
    namespaces: Option<Vec<String>>,
    group: String,
    version: String,
    kind: String,
    plural: String,
    is_namespaced: bool,
) -> AppResult<Vec<Value>> {
    DynamicK8sResources::list(
        name,
        namespaces,
        group,
        version,
        kind,
        plural,
        is_namespaced,
    )
    .await
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn watch_custom_resources(
    app_handle: AppHandle,
    name: String,
    namespaces: Option<Vec<String>>,
    group: String,
    version: String,
    kind: String,
    plural: String,
    is_namespaced: bool,
    state: tauri::State<'_, WatchManager>,
) -> AppResult<String> {
    // Multi-segment channel key. `validate_resource_name` permits slashes for
    // exactly this case, and `cluster_prefix` only inspects the first segment, so
    // per-cluster teardown still matches these watches.
    let resource_key = if group.is_empty() {
        format!("custom_resources/{version}/{plural}")
    } else {
        format!("custom_resources/{group}/{version}/{plural}")
    };

    start_watch(
        app_handle,
        name,
        &resource_key,
        namespaces,
        state,
        // `FnOnce`, so the GVK strings move in rather than being cloned per call.
        move |app_handle, ctx_name, ns_list, event_name, cancel| {
            DynamicK8sResources::watch(
                app_handle,
                ctx_name,
                ns_list,
                group,
                version,
                kind,
                plural,
                is_namespaced,
                event_name,
                cancel,
            )
        },
    )
    .await
}

#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub async fn delete_custom_resources(
    name: String,
    namespace: Option<String>,
    group: String,
    version: String,
    kind: String,
    plural: String,
    is_namespaced: bool,
    resource_names: Vec<String>,
) -> AppResult<Vec<Result<String, String>>> {
    DynamicK8sResources::delete(
        name,
        namespace,
        group,
        version,
        kind,
        plural,
        is_namespaced,
        resource_names,
    )
    .await
}
