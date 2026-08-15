//! Helm command surface.
//!
//! `HelmManager` is still mostly a shell-out wrapper that returns pre-formatted
//! `String` errors, so each command bridges those into [`AppError::Internal`] rather
//! than re-deriving a kind that the underlying layer never captured. Only
//! `watch_releases` has been moved to `AppResult` end-to-end, because
//! `common::start_watch` requires it.

use crate::commands::common::start_watch;
use crate::error::{AppError, AppResult};
use crate::manager::k8s::helm::HelmManager;
use crate::utils::watcher::WatchManager;
use serde_json::Value;
use tauri::AppHandle;

#[tauri::command]
pub async fn helm_list_releases(
    name: String,
    namespaces: Option<Vec<String>>,
) -> AppResult<Vec<Value>> {
    HelmManager::list_releases(name, namespaces)
        .await
        .map_err(AppError::Internal)
}

#[tauri::command]
pub async fn helm_uninstall_releases(
    name: String,
    namespace: Option<String>,
    release_names: Vec<String>,
) -> AppResult<Vec<Result<String, String>>> {
    // Inner `String` error is the unchanged per-release wire shape.
    HelmManager::uninstall_releases(name, namespace, release_names)
        .await
        .map_err(AppError::Internal)
}

#[tauri::command]
pub async fn helm_list_charts(name: String) -> AppResult<Vec<Value>> {
    HelmManager::list_charts(name)
        .await
        .map_err(AppError::Internal)
}

#[tauri::command]
pub async fn watch_helm_releases(
    app_handle: AppHandle,
    name: String,
    namespaces: Option<Vec<String>>,
    state: tauri::State<'_, WatchManager>,
) -> AppResult<String> {
    start_watch(
        app_handle,
        name,
        // `&str` literal: `start_watch` only borrows the segment. Unchanged value, so
        // the `k8s://<ctx>/helm_releases[...]` event name the frontend gets is the same.
        "helm_releases",
        namespaces,
        state,
        // `HelmManager::watch_releases` now ends in a `CancellationToken`, so the fn
        // item satisfies the `FnOnce` bound directly — no closure or `Arc` needed.
        HelmManager::watch_releases,
    )
    .await
}

#[tauri::command]
pub async fn helm_get_values(
    name: String,
    namespace: Option<String>,
    release_name: String,
) -> AppResult<String> {
    HelmManager::get_values(name, namespace, release_name)
        .await
        .map_err(AppError::Internal)
}

#[tauri::command]
pub async fn helm_get_history(
    name: String,
    namespace: Option<String>,
    release_name: String,
) -> AppResult<Vec<Value>> {
    HelmManager::get_history(name, namespace, release_name)
        .await
        .map_err(AppError::Internal)
}

#[tauri::command]
pub async fn helm_upgrade_release(
    name: String,
    namespace: Option<String>,
    release_name: String,
    chart: Option<String>,
    values: Option<Value>,
    reuse_values: bool,
    version: Option<String>,
) -> AppResult<String> {
    HelmManager::upgrade_release(
        name,
        namespace,
        release_name,
        chart,
        values,
        reuse_values,
        version,
    )
    .await
    .map_err(AppError::Internal)
}

#[tauri::command]
pub async fn helm_rollback_release(
    name: String,
    namespace: Option<String>,
    release_name: String,
    revision: i32,
) -> AppResult<String> {
    HelmManager::rollback_release(name, namespace, release_name, revision)
        .await
        .map_err(AppError::Internal)
}
