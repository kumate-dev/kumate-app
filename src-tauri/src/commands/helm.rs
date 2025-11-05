use crate::commands::common::watch as watch_common;
use crate::constants::helm_repos::HELM_REPOS;
use crate::manager::k8s::client::K8sClient;
use crate::types::event::EventType;
use crate::utils::watcher::WatchManager;
use futures_util::{Stream, StreamExt};
use k8s_openapi::api::core::v1::{ConfigMap, Secret};
use kube::api::{Api, ListParams, WatchEvent, WatchParams};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::pin::Pin;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};

// Helm CLI is intentionally not used.

#[tauri::command]
pub async fn helm_list_releases(
    name: String,
    namespaces: Option<Vec<String>>,
) -> Result<Vec<Value>, String> {
    let client = K8sClient::for_context(&name).await?;

    let use_all = namespaces
        .as_ref()
        .map(|ns| {
            ns.is_empty()
                || ns.iter().any(|n| {
                    let lower = n.trim().to_lowercase();
                    lower.is_empty() || lower == "*" || lower == "all" || lower == "all namespaces"
                })
        })
        .unwrap_or(true);

    let target_namespaces: Vec<Option<String>> = if use_all {
        vec![None]
    } else {
        namespaces.unwrap_or_default().into_iter().map(|n| Some(n)).collect()
    };

    let mut items: Vec<Value> = Vec::new();
    let lp = ListParams::default();

    for ns in target_namespaces.into_iter() {
        let secrets_api = K8sClient::api::<Secret>(client.clone(), ns.clone()).await;
        let cms_api = K8sClient::api::<ConfigMap>(client.clone(), ns.clone()).await;

        // Helm v3 stores releases in Secrets by default
        let secrets =
            secrets_api.list(&lp).await.map_err(|e| format!("Failed to list secrets: {}", e))?;
        for s in secrets.items.into_iter() {
            let labels = s.metadata.labels.clone().unwrap_or_default();
            let owner = labels.get("owner").cloned().unwrap_or_default();
            let name_field = s.metadata.name.clone().unwrap_or_default();
            let is_helm = owner == "helm" || name_field.starts_with("sh.helm.release.v1.");
            if !is_helm {
                continue;
            }

            // Try to get release properties from labels; otherwise parse from name
            let release_name = labels.get("name").cloned().unwrap_or_else(|| {
                name_field
                    .trim()
                    .trim_start_matches("sh.helm.release.v1.")
                    .split(".v")
                    .next()
                    .unwrap_or("")
                    .to_string()
            });
            let revision = labels.get("version").cloned().unwrap_or_else(|| {
                if let Some(idx) = name_field.rfind(".v") {
                    name_field[idx + 2..].to_string()
                } else {
                    String::new()
                }
            });
            let status = labels.get("status").cloned().unwrap_or_default();
            let namespace = s.metadata.namespace.clone().unwrap_or_default();

            let mut obj = serde_json::json!({
                "name": release_name,
                "namespace": namespace,
                "revision": revision,
                "status": status,
            });
            obj["metadata"] = serde_json::json!({
                "name": release_name,
                "namespace": namespace,
            });
            items.push(obj);
        }

        // Helm v2 or alternate storage may use ConfigMaps
        let cms =
            cms_api.list(&lp).await.map_err(|e| format!("Failed to list configmaps: {}", e))?;
        for c in cms.items.into_iter() {
            let labels = c.metadata.labels.clone().unwrap_or_default();
            let owner = labels.get("owner").cloned().unwrap_or_default();
            if owner != "helm" {
                continue;
            }

            let release_name = labels.get("name").cloned().unwrap_or_default();
            let revision = labels.get("version").cloned().unwrap_or_default();
            let status = labels.get("status").cloned().unwrap_or_default();
            let namespace = c.metadata.namespace.clone().unwrap_or_default();

            let mut obj = serde_json::json!({
                "name": release_name,
                "namespace": namespace,
                "revision": revision,
                "status": status,
            });
            obj["metadata"] = serde_json::json!({
                "name": release_name,
                "namespace": namespace,
            });
            items.push(obj);
        }
    }

    Ok(items)
}

#[tauri::command]
pub async fn helm_uninstall_releases(
    _name: String,
    _namespace: Option<String>,
    _release_names: Vec<String>,
) -> Result<Vec<Result<String, String>>, String> {
    Err("Uninstall without Helm CLI is not supported".to_string())
}

#[tauri::command]
pub async fn helm_list_charts(_name: String) -> Result<Vec<Value>, String> {
    // Fetch index.yaml from known repositories and aggregate entries.
    // This avoids requiring the Helm CLI, but depends on public repo endpoints.

    #[derive(Debug, Deserialize, Serialize)]
    struct ChartVersion {
        #[serde(rename = "version")]
        chart_version: String,
        #[serde(rename = "appVersion")]
        app_version: Option<String>,
        description: Option<String>,
        urls: Option<Vec<String>>,
    }

    #[derive(Debug, Deserialize)]
    struct IndexYaml {
        entries: HashMap<String, Vec<ChartVersion>>,
    }

    let client = Client::builder()
        .user_agent("kumate/0.1")
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let mut results: Vec<Value> = Vec::new();
    for repo in HELM_REPOS.iter() {
        let base = repo.trim_end_matches('/');
        let url = format!("{}/index.yaml", base);
        let resp =
            client.get(&url).send().await.map_err(|e| format!("Failed to fetch {}: {}", url, e))?;
        if !resp.status().is_success() {
            // Skip this repo but continue others
            continue;
        }
        let bytes = resp.bytes().await.map_err(|e| format!("Failed to read {}: {}", url, e))?;
        let index: IndexYaml = serde_yaml::from_slice(&bytes)
            .map_err(|e| format!("Failed to parse {}: {}", url, e))?;

        for (name, versions) in index.entries.into_iter() {
            for v in versions.into_iter() {
                let urls = v
                    .urls
                    .unwrap_or_default()
                    .into_iter()
                    .map(|u| {
                        if u.starts_with("http://") || u.starts_with("https://") {
                            u
                        } else {
                            format!("{}/{}", base, u)
                        }
                    })
                    .collect::<Vec<_>>();
                results.push(serde_json::json!({
                    "name": name,
                    "chart_version": v.chart_version,
                    "app_version": v.app_version,
                    "description": v.description,
                    "urls": urls,
                }));
            }
        }
    }

    Ok(results)
}

fn is_helm_secret(s: &Secret) -> bool {
    let labels = s.metadata.labels.clone().unwrap_or_default();
    let owner = labels.get("owner").cloned().unwrap_or_default();
    let name_field = s.metadata.name.clone().unwrap_or_default();
    owner == "helm" || name_field.starts_with("sh.helm.release.v1.")
}

fn build_release_from_secret(s: &Secret) -> Value {
    let labels = s.metadata.labels.clone().unwrap_or_default();
    let name_field = s.metadata.name.clone().unwrap_or_default();
    let release_name = labels.get("name").cloned().unwrap_or_else(|| {
        name_field
            .trim()
            .trim_start_matches("sh.helm.release.v1.")
            .split(".v")
            .next()
            .unwrap_or("")
            .to_string()
    });
    let revision = labels.get("version").cloned().unwrap_or_else(|| {
        if let Some(idx) = name_field.rfind(".v") {
            name_field[idx + 2..].to_string()
        } else {
            String::new()
        }
    });
    let status = labels.get("status").cloned().unwrap_or_default();
    let namespace = s.metadata.namespace.clone().unwrap_or_default();

    let mut obj = serde_json::json!({
        "name": release_name,
        "namespace": namespace,
        "revision": revision,
        "status": status,
    });
    obj["metadata"] = serde_json::json!({
        "name": release_name,
        "namespace": namespace,
    });
    obj
}

fn is_helm_config_map(c: &ConfigMap) -> bool {
    let labels = c.metadata.labels.clone().unwrap_or_default();
    let owner = labels.get("owner").cloned().unwrap_or_default();
    owner == "helm"
}

fn build_release_from_config_map(c: &ConfigMap) -> Value {
    let labels = c.metadata.labels.clone().unwrap_or_default();
    let release_name = labels.get("name").cloned().unwrap_or_default();
    let revision = labels.get("version").cloned().unwrap_or_default();
    let status = labels.get("status").cloned().unwrap_or_default();
    let namespace = c.metadata.namespace.clone().unwrap_or_default();

    let mut obj = serde_json::json!({
        "name": release_name,
        "namespace": namespace,
        "revision": revision,
        "status": status,
    });
    obj["metadata"] = serde_json::json!({
        "name": release_name,
        "namespace": namespace,
    });
    obj
}

async fn watch_stream_secrets(
    api: &Api<Secret>,
) -> Result<Pin<Box<dyn Stream<Item = Result<WatchEvent<Secret>, kube::Error>> + Send>>, String> {
    let wp: WatchParams = WatchParams {
        send_initial_events: true,
        ..Default::default()
    };
    let stream: Pin<Box<dyn Stream<Item = Result<WatchEvent<Secret>, kube::Error>> + Send>> =
        api.watch(&wp, "").await.map_err(|e| e.to_string())?.boxed();
    Ok(stream)
}

async fn watch_stream_config_maps(
    api: &Api<ConfigMap>,
) -> Result<Pin<Box<dyn Stream<Item = Result<WatchEvent<ConfigMap>, kube::Error>> + Send>>, String>
{
    let wp: WatchParams = WatchParams {
        send_initial_events: true,
        ..Default::default()
    };
    let stream: Pin<Box<dyn Stream<Item = Result<WatchEvent<ConfigMap>, kube::Error>> + Send>> =
        api.watch(&wp, "").await.map_err(|e| e.to_string())?.boxed();
    Ok(stream)
}

fn emit_helm_event(app_handle: &AppHandle, event_name: &str, kind: EventType, obj: Value) {
    let event = serde_json::json!({ "type": kind, "object": obj });
    let _ = app_handle.emit(event_name, event);
}

async fn watch_helm_impl(
    app_handle: AppHandle,
    name: String,
    namespaces: Option<Vec<String>>,
    event_name: String,
) -> Result<(), String> {
    let client = K8sClient::for_context(&name).await?;
    let target_namespaces: Vec<Option<String>> = match namespaces {
        Some(v) if !v.is_empty() => v.into_iter().map(Some).collect(),
        _ => vec![None],
    };

    for ns in target_namespaces {
        // Secrets (Helm v3 default)
        {
            let api: Api<Secret> = K8sClient::api::<Secret>(client.clone(), ns.clone()).await;
            let mut stream = watch_stream_secrets(&api).await?;
            let app_handle_clone = app_handle.clone();
            let event_name_clone = event_name.clone();
            tokio::spawn(async move {
                while let Some(status) = stream.next().await {
                    match status {
                        Ok(WatchEvent::Added(obj)) => {
                            if is_helm_secret(&obj) {
                                emit_helm_event(
                                    &app_handle_clone,
                                    &event_name_clone,
                                    EventType::ADDED,
                                    build_release_from_secret(&obj),
                                );
                            }
                        }
                        Ok(WatchEvent::Modified(obj)) => {
                            if is_helm_secret(&obj) {
                                emit_helm_event(
                                    &app_handle_clone,
                                    &event_name_clone,
                                    EventType::MODIFIED,
                                    build_release_from_secret(&obj),
                                );
                            }
                        }
                        Ok(WatchEvent::Deleted(obj)) => {
                            if is_helm_secret(&obj) {
                                emit_helm_event(
                                    &app_handle_clone,
                                    &event_name_clone,
                                    EventType::DELETED,
                                    build_release_from_secret(&obj),
                                );
                            }
                        }
                        Err(e) => eprintln!("Watch error (secrets): {}", e),
                        _ => {}
                    }
                }
            });
        }

        // ConfigMaps (Helm v2 or alternate storage)
        {
            let api: Api<ConfigMap> = K8sClient::api::<ConfigMap>(client.clone(), ns.clone()).await;
            let mut stream = watch_stream_config_maps(&api).await?;
            let app_handle_clone = app_handle.clone();
            let event_name_clone = event_name.clone();
            tokio::spawn(async move {
                while let Some(status) = stream.next().await {
                    match status {
                        Ok(WatchEvent::Added(obj)) => {
                            if is_helm_config_map(&obj) {
                                emit_helm_event(
                                    &app_handle_clone,
                                    &event_name_clone,
                                    EventType::ADDED,
                                    build_release_from_config_map(&obj),
                                );
                            }
                        }
                        Ok(WatchEvent::Modified(obj)) => {
                            if is_helm_config_map(&obj) {
                                emit_helm_event(
                                    &app_handle_clone,
                                    &event_name_clone,
                                    EventType::MODIFIED,
                                    build_release_from_config_map(&obj),
                                );
                            }
                        }
                        Ok(WatchEvent::Deleted(obj)) => {
                            if is_helm_config_map(&obj) {
                                emit_helm_event(
                                    &app_handle_clone,
                                    &event_name_clone,
                                    EventType::DELETED,
                                    build_release_from_config_map(&obj),
                                );
                            }
                        }
                        Err(e) => eprintln!("Watch error (configmaps): {}", e),
                        _ => {}
                    }
                }
            });
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn watch_helm_releases(
    app_handle: AppHandle,
    name: String,
    namespaces: Option<Vec<String>>,
    state: tauri::State<'_, WatchManager>,
) -> Result<String, String> {
    let watch_fn = Arc::new(
        |app_handle: AppHandle,
         name: String,
         namespaces: Option<Vec<String>>,
         event_name: String| async move {
            watch_helm_impl(app_handle, name, namespaces, event_name).await
        },
    );

    watch_common(app_handle, name, "helm_releases".to_string(), namespaces, state, watch_fn).await
}
