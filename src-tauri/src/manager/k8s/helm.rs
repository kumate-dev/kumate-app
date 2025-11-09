use crate::constants::helm_repos::HELM_REPOS;
use crate::manager::k8s::client::K8sClient;
use crate::types::event::EventType;
use futures_util::{Stream, StreamExt};
use k8s_openapi::api::core::v1::{ConfigMap, Secret};
use kube::api::{Api, ListParams, WatchEvent, WatchParams};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::pin::Pin;
use tauri::{AppHandle, Emitter};
use tokio::process::Command;

pub struct HelmManager;

impl HelmManager {
    pub async fn list_releases(
        context_name: String,
        namespaces: Option<Vec<String>>,
    ) -> Result<Vec<Value>, String> {
        if Self::helm_available().await {
            return Self::helm_cli_list_releases(&context_name, namespaces).await;
        }

        // Fallback: scan Secrets/ConfigMaps via Kubernetes API
        let client = K8sClient::for_context(&context_name).await?;
        let use_all = namespaces
            .as_ref()
            .map(|ns| {
                ns.is_empty()
                    || ns.iter().any(|n| {
                        let lower = n.trim().to_lowercase();
                        lower.is_empty()
                            || lower == "*"
                            || lower == "all"
                            || lower == "all namespaces"
                    })
            })
            .unwrap_or(true);

        let target_namespaces: Vec<Option<String>> = if use_all {
            vec![None]
        } else {
            namespaces.unwrap_or_default().into_iter().map(Some).collect()
        };

        let mut items: Vec<Value> = Vec::new();
        let lp = ListParams::default();

        for ns in target_namespaces.into_iter() {
            let secrets_api = K8sClient::api::<Secret>(client.clone(), ns.clone()).await;
            let cms_api = K8sClient::api::<ConfigMap>(client.clone(), ns.clone()).await;

            let secrets = secrets_api
                .list(&lp)
                .await
                .map_err(|e| format!("Failed to list secrets: {}", e))?;
            for s in secrets.items.into_iter() {
                if !Self::is_helm_secret(&s) {
                    continue;
                }
                items.push(Self::build_release_from_secret(&s));
            }

            let cms =
                cms_api.list(&lp).await.map_err(|e| format!("Failed to list configmaps: {}", e))?;
            for c in cms.items.into_iter() {
                if !Self::is_helm_config_map(&c) {
                    continue;
                }
                items.push(Self::build_release_from_config_map(&c));
            }
        }

        Ok(items)
    }

    pub async fn uninstall_releases(
        context_name: String,
        namespace: Option<String>,
        release_names: Vec<String>,
    ) -> Result<Vec<Result<String, String>>, String> {
        let helm_bin = Self::resolve_helm_bin()
            .await
            .ok_or_else(|| "Helm CLI is not available; uninstall requires Helm".to_string())?;

        // If namespace is not provided or is a special "all namespaces" token, resolve namespaces from `helm list -A`
        let ns_hint = namespace.as_ref().map(|s| s.trim()).and_then(|s| {
            let lower = s.to_lowercase();
            let invalid = ["*", "all", "all namespaces", "all_namespaces"];
            if s.is_empty() || invalid.contains(&lower.as_str()) {
                None
            } else {
                Some(s)
            }
        });
        let mut name_to_ns: HashMap<String, String> = HashMap::new();
        if ns_hint.is_none() {
            if let Ok(items) = Self::helm_cli_list_releases(&context_name, None).await {
                for item in items.into_iter() {
                    let n = item.get("name").and_then(|x| x.as_str()).unwrap_or("").to_string();
                    let ns =
                        item.get("namespace").and_then(|x| x.as_str()).unwrap_or("").to_string();
                    if !n.is_empty() && !ns.is_empty() {
                        name_to_ns.insert(n, ns);
                    }
                }
            }
        }

        let mut results: Vec<Result<String, String>> = Vec::new();
        for rel in release_names.into_iter() {
            // Determine namespace: provided hint or resolved per release
            let ns_for_rel =
                ns_hint.map(|s| s.to_string()).or_else(|| name_to_ns.get(&rel).cloned());

            let mut cmd = Command::new(&helm_bin);
            cmd.arg("uninstall");
            cmd.arg(&rel);
            if let Some(ns) = ns_for_rel.as_ref() {
                cmd.arg("--namespace").arg(ns);
            }
            if !context_name.trim().is_empty() {
                cmd.arg("--kube-context").arg(&context_name);
            }

            match cmd.output().await {
                Ok(out) if out.status.success() => results.push(Ok(rel)),
                Ok(out) => {
                    let stderr = String::from_utf8_lossy(&out.stderr).to_string();
                    let stdout = String::from_utf8_lossy(&out.stdout).to_string();
                    let msg = if !stderr.trim().is_empty() { stderr } else { stdout };
                    results.push(Err(format!("helm uninstall failed: {}", msg.trim())));
                }
                Err(e) => results.push(Err(format!("failed to run helm uninstall: {}", e))),
            }
        }

        Ok(results)
    }

    pub async fn list_charts(_context_name: String) -> Result<Vec<Value>, String> {
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
            let resp = client
                .get(&url)
                .send()
                .await
                .map_err(|e| format!("Failed to fetch {}: {}", url, e))?;
            if !resp.status().is_success() {
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

    pub async fn watch_releases(
        app_handle: AppHandle,
        context_name: String,
        namespaces: Option<Vec<String>>,
        event_name: String,
    ) -> Result<(), String> {
        let client = K8sClient::for_context(&context_name).await?;
        let target_namespaces: Vec<Option<String>> = match namespaces {
            Some(v) if !v.is_empty() => v.into_iter().map(Some).collect(),
            _ => vec![None],
        };

        for ns in target_namespaces {
            {
                let api: Api<Secret> = K8sClient::api::<Secret>(client.clone(), ns.clone()).await;
                let mut stream = Self::watch_stream_secrets(&api).await?;
                let app_handle_clone = app_handle.clone();
                let event_name_clone = event_name.clone();
                tokio::spawn(async move {
                    while let Some(status) = stream.next().await {
                        match status {
                            Ok(WatchEvent::Added(obj)) => {
                                if Self::is_helm_secret(&obj) {
                                    Self::emit_helm_event(
                                        &app_handle_clone,
                                        &event_name_clone,
                                        EventType::ADDED,
                                        Self::build_release_from_secret(&obj),
                                    );
                                }
                            }
                            Ok(WatchEvent::Modified(obj)) => {
                                if Self::is_helm_secret(&obj) {
                                    Self::emit_helm_event(
                                        &app_handle_clone,
                                        &event_name_clone,
                                        EventType::MODIFIED,
                                        Self::build_release_from_secret(&obj),
                                    );
                                }
                            }
                            Ok(WatchEvent::Deleted(obj)) => {
                                if Self::is_helm_secret(&obj) {
                                    Self::emit_helm_event(
                                        &app_handle_clone,
                                        &event_name_clone,
                                        EventType::DELETED,
                                        Self::build_release_from_secret(&obj),
                                    );
                                }
                            }
                            Err(e) => eprintln!("Watch error (secrets): {}", e),
                            _ => {}
                        }
                    }
                });
            }

            {
                let api: Api<ConfigMap> =
                    K8sClient::api::<ConfigMap>(client.clone(), ns.clone()).await;
                let mut stream = Self::watch_stream_config_maps(&api).await?;
                let app_handle_clone = app_handle.clone();
                let event_name_clone = event_name.clone();
                tokio::spawn(async move {
                    while let Some(status) = stream.next().await {
                        match status {
                            Ok(WatchEvent::Added(obj)) => {
                                if Self::is_helm_config_map(&obj) {
                                    Self::emit_helm_event(
                                        &app_handle_clone,
                                        &event_name_clone,
                                        EventType::ADDED,
                                        Self::build_release_from_config_map(&obj),
                                    );
                                }
                            }
                            Ok(WatchEvent::Modified(obj)) => {
                                if Self::is_helm_config_map(&obj) {
                                    Self::emit_helm_event(
                                        &app_handle_clone,
                                        &event_name_clone,
                                        EventType::MODIFIED,
                                        Self::build_release_from_config_map(&obj),
                                    );
                                }
                            }
                            Ok(WatchEvent::Deleted(obj)) => {
                                if Self::is_helm_config_map(&obj) {
                                    Self::emit_helm_event(
                                        &app_handle_clone,
                                        &event_name_clone,
                                        EventType::DELETED,
                                        Self::build_release_from_config_map(&obj),
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

    // Internal helpers
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

    fn emit_helm_event(app_handle: &AppHandle, event_name: &str, kind: EventType, obj: Value) {
        let event = serde_json::json!({ "type": kind, "object": obj });
        let _ = app_handle.emit(event_name, event);
    }

    async fn watch_stream_secrets(
        api: &Api<Secret>,
    ) -> Result<Pin<Box<dyn Stream<Item = Result<WatchEvent<Secret>, kube::Error>> + Send>>, String>
    {
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
    ) -> Result<
        Pin<Box<dyn Stream<Item = Result<WatchEvent<ConfigMap>, kube::Error>> + Send>>,
        String,
    > {
        let wp: WatchParams = WatchParams {
            send_initial_events: true,
            ..Default::default()
        };
        let stream: Pin<Box<dyn Stream<Item = Result<WatchEvent<ConfigMap>, kube::Error>> + Send>> =
            api.watch(&wp, "").await.map_err(|e| e.to_string())?.boxed();
        Ok(stream)
    }

    async fn helm_available() -> bool {
        Self::resolve_helm_bin().await.is_some()
    }

    async fn resolve_helm_bin() -> Option<String> {
        // Try PATH first
        if let Ok(out) = Command::new("helm").arg("version").arg("--short").output().await {
            if out.status.success() {
                return Some("helm".to_string());
            }
        }
        // Common macOS/Homebrew locations
        for p in [
            "/opt/homebrew/bin/helm",
            "/usr/local/bin/helm",
            "/usr/bin/helm",
        ]
        .iter()
        {
            if let Ok(out) = Command::new(p).arg("version").arg("--short").output().await {
                if out.status.success() {
                    return Some(p.to_string());
                }
            }
        }
        None
    }

    async fn helm_cli_list_releases(
        kube_context: &str,
        namespaces: Option<Vec<String>>,
    ) -> Result<Vec<Value>, String> {
        let helm_bin = Self::resolve_helm_bin()
            .await
            .ok_or_else(|| "Helm CLI is not available; listing requires Helm".to_string())?;
        let use_all = namespaces
            .as_ref()
            .map(|ns| {
                ns.is_empty()
                    || ns.iter().any(|n| {
                        let lower = n.trim().to_lowercase();
                        lower.is_empty()
                            || lower == "*"
                            || lower == "all"
                            || lower == "all namespaces"
                    })
            })
            .unwrap_or(true);

        let mut items: Vec<Value> = Vec::new();

        if use_all {
            let mut cmd = Command::new(&helm_bin);
            cmd.arg("list").arg("-o").arg("json").arg("-A");
            if !kube_context.trim().is_empty() {
                cmd.arg("--kube-context").arg(kube_context);
            }
            let out = cmd.output().await.map_err(|e| format!("Failed to run helm list: {}", e))?;
            if !out.status.success() {
                let stderr = String::from_utf8_lossy(&out.stderr);
                return Err(format!("helm list failed: {}", stderr.trim()));
            }
            let v: Value = serde_json::from_slice(&out.stdout)
                .map_err(|e| format!("Failed to parse helm list json: {}", e))?;
            Self::collect_items_from_helm_json(&mut items, &v);
        } else {
            for ns in namespaces.unwrap_or_default() {
                let mut cmd = Command::new(&helm_bin);
                cmd.arg("list").arg("-o").arg("json").arg("--namespace").arg(&ns);
                if !kube_context.trim().is_empty() {
                    cmd.arg("--kube-context").arg(kube_context);
                }
                let out = cmd
                    .output()
                    .await
                    .map_err(|e| format!("Failed to run helm list for namespace {}: {}", ns, e))?;
                if !out.status.success() {
                    let stderr = String::from_utf8_lossy(&out.stderr);
                    return Err(format!(
                        "helm list failed for namespace {}: {}",
                        ns,
                        stderr.trim()
                    ));
                }
                let v: Value = serde_json::from_slice(&out.stdout).map_err(|e| {
                    format!("Failed to parse helm list json for namespace {}: {}", ns, e)
                })?;
                Self::collect_items_from_helm_json(&mut items, &v);
            }
        }

        Ok(items)
    }

    fn collect_items_from_helm_json(items: &mut Vec<Value>, v: &Value) {
        if let Some(arr) = v.as_array() {
            for r in arr {
                let name = r.get("name").and_then(|x| x.as_str()).unwrap_or("");
                let namespace = r.get("namespace").and_then(|x| x.as_str()).unwrap_or("");
                let revision = r.get("revision").map(|x| x.to_string()).unwrap_or_default();
                let status = r.get("status").and_then(|x| x.as_str()).unwrap_or("");
                let updated = r.get("updated").and_then(|x| x.as_str()).unwrap_or("");
                let chart = r.get("chart").and_then(|x| x.as_str()).unwrap_or("");
                let app_version = r.get("app_version").and_then(|x| x.as_str()).unwrap_or("");
                let mut obj = serde_json::json!({
                    "name": name,
                    "namespace": namespace,
                    "revision": revision,
                    "status": status,
                    "updated": updated,
                    "chart": chart,
                    "app_version": app_version,
                });
                obj["metadata"] = serde_json::json!({
                    "name": name,
                    "namespace": namespace,
                });
                items.push(obj);
            }
        }
    }
}
