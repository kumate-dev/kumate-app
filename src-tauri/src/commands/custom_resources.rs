use std::sync::Arc;

use crate::commands::common::watch;
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
) -> Result<Value, String> {
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
) -> Result<Value, String> {
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
) -> Result<Vec<Value>, String> {
    DynamicK8sResources::list(name, namespaces, group, version, kind, plural, is_namespaced).await
}

#[tauri::command]
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
) -> Result<String, String> {
    let resource_key = if group.is_empty() {
        format!("custom_resources/{}/{}", version, plural)
    } else {
        format!("custom_resources/{}/{}/{}", group, version, plural)
    };

    watch(
        app_handle,
        name,
        resource_key,
        namespaces.clone(),
        state,
        Arc::new(move |app_handle, ctx_name, ns_list, event_name| {
            DynamicK8sResources::watch(
                app_handle,
                ctx_name,
                ns_list,
                group.clone(),
                version.clone(),
                kind.clone(),
                plural.clone(),
                is_namespaced,
                event_name,
            )
        }),
    )
    .await
}

#[tauri::command]
pub async fn delete_custom_resources(
    name: String,
    namespace: Option<String>,
    group: String,
    version: String,
    kind: String,
    plural: String,
    is_namespaced: bool,
    resource_names: Vec<String>,
) -> Result<Vec<Result<String, String>>, String> {
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
