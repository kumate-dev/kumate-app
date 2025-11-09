use crate::manager::k8s::client::K8sClient;
use crate::types::event::EventType;
use futures_util::{Stream, StreamExt};
use k8s_openapi::api::core::v1::{ConfigMap, Secret};
use kube::api::{Api, ListParams, WatchEvent, WatchParams};
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

    pub async fn get_values(
        context_name: String,
        namespace: Option<String>,
        release_name: String,
    ) -> Result<String, String> {
        let helm_bin = Self::resolve_helm_bin()
            .await
            .ok_or_else(|| "Helm CLI is not available; get values requires Helm".to_string())?;

        // Resolve namespace if not provided
        let ns_hint = namespace.as_ref().map(|s| s.trim()).and_then(|s| {
            let lower = s.to_lowercase();
            let invalid = ["*", "all", "all namespaces", "all_namespaces"];
            if s.is_empty() || invalid.contains(&lower.as_str()) {
                None
            } else {
                Some(s)
            }
        });
        let ns_for_rel = if ns_hint.is_some() {
            ns_hint.map(|s| s.to_string())
        } else {
            // Try to resolve from helm list -A
            if let Ok(items) = Self::helm_cli_list_releases(&context_name, None).await {
                items.into_iter().find_map(|item| {
                    let n = item.get("name").and_then(|x| x.as_str()).unwrap_or("");
                    if n == release_name {
                        item.get("namespace").and_then(|x| x.as_str()).map(|s| s.to_string())
                    } else {
                        None
                    }
                })
            } else {
                None
            }
        };

        let mut cmd = Command::new(&helm_bin);
        cmd.arg("get").arg("values").arg(&release_name).arg("--all").arg("-o").arg("yaml");
        if let Some(ns) = ns_for_rel.as_ref() {
            cmd.arg("--namespace").arg(ns);
        }
        if !context_name.trim().is_empty() {
            cmd.arg("--kube-context").arg(&context_name);
        }

        match cmd.output().await {
            Ok(out) if out.status.success() => Ok(String::from_utf8_lossy(&out.stdout).to_string()),
            Ok(out) => {
                let stderr = String::from_utf8_lossy(&out.stderr);
                Err(format!("helm get values failed: {}", stderr.trim()))
            }
            Err(e) => Err(format!("failed to run helm get values: {}", e)),
        }
    }

    pub async fn get_history(
        context_name: String,
        namespace: Option<String>,
        release_name: String,
    ) -> Result<Vec<Value>, String> {
        let helm_bin = Self::resolve_helm_bin()
            .await
            .ok_or_else(|| "Helm CLI is not available; history requires Helm".to_string())?;

        // Resolve namespace similarly
        let ns_hint = namespace.as_ref().map(|s| s.trim()).and_then(|s| {
            let lower = s.to_lowercase();
            let invalid = ["*", "all", "all namespaces", "all_namespaces"];
            if s.is_empty() || invalid.contains(&lower.as_str()) {
                None
            } else {
                Some(s)
            }
        });
        let ns_for_rel = if ns_hint.is_some() {
            ns_hint.map(|s| s.to_string())
        } else {
            if let Ok(items) = Self::helm_cli_list_releases(&context_name, None).await {
                items.into_iter().find_map(|item| {
                    let n = item.get("name").and_then(|x| x.as_str()).unwrap_or("");
                    if n == release_name {
                        item.get("namespace").and_then(|x| x.as_str()).map(|s| s.to_string())
                    } else {
                        None
                    }
                })
            } else {
                None
            }
        };

        let mut cmd = Command::new(&helm_bin);
        cmd.arg("history").arg(&release_name).arg("-o").arg("json");
        if let Some(ns) = ns_for_rel.as_ref() {
            cmd.arg("--namespace").arg(ns);
        }
        if !context_name.trim().is_empty() {
            cmd.arg("--kube-context").arg(&context_name);
        }
        let out = cmd.output().await.map_err(|e| format!("Failed to run helm history: {}", e))?;
        if !out.status.success() {
            let stderr = String::from_utf8_lossy(&out.stderr);
            return Err(format!("helm history failed: {}", stderr.trim()));
        }
        let v: Value = serde_json::from_slice(&out.stdout)
            .map_err(|e| format!("Failed to parse helm history json: {}", e))?;
        if let Some(arr) = v.as_array() {
            Ok(arr.clone())
        } else {
            Ok(vec![])
        }
    }

    pub async fn upgrade_release(
        context_name: String,
        namespace: Option<String>,
        release_name: String,
        chart: Option<String>,
        values: Option<Value>,
        reuse_values: bool,
        version: Option<String>,
    ) -> Result<String, String> {
        use tokio::fs::File;
        use tokio::io::AsyncWriteExt;

        let helm_bin = Self::resolve_helm_bin()
            .await
            .ok_or_else(|| "Helm CLI is not available; upgrade requires Helm".to_string())?;

        // Resolve namespace and current chart
        let ns_hint = namespace.as_ref().map(|s| s.trim()).and_then(|s| {
            let lower = s.to_lowercase();
            let invalid = ["*", "all", "all namespaces", "all_namespaces"];
            if s.is_empty() || invalid.contains(&lower.as_str()) {
                None
            } else {
                Some(s)
            }
        });
        let mut target_ns: Option<String> = ns_hint.map(|s| s.to_string());
        let mut current_chart_name: Option<String> = None;
        if target_ns.is_none() || chart.is_none() {
            if let Ok(items) = Self::helm_cli_list_releases(&context_name, None).await {
                for item in items.into_iter() {
                    let n = item.get("name").and_then(|x| x.as_str()).unwrap_or("");
                    if n == release_name {
                        if target_ns.is_none() {
                            target_ns = item
                                .get("namespace")
                                .and_then(|x| x.as_str())
                                .map(|s| s.to_string());
                        }
                        if current_chart_name.is_none() {
                            if let Some(c) = item.get("chart").and_then(|x| x.as_str()) {
                                // chart like "fluent-bit-0.21.6" => name before last dash
                                let parts: Vec<&str> = c.split('-').collect();
                                if parts.len() > 1 {
                                    current_chart_name = Some(parts[..parts.len() - 1].join("-"));
                                } else {
                                    current_chart_name = Some(c.to_string());
                                }
                            }
                        }
                        break;
                    }
                }
            }
        }

        let chart_ref = chart.or(current_chart_name).ok_or_else(|| {
            "Missing chart reference; please provide chart (e.g., repo/chart) for upgrade"
                .to_string()
        })?;

        let mut chart_arg = chart_ref.clone();
        let needs_resolution = !chart_arg.starts_with("http://")
            && !chart_arg.starts_with("https://")
            && !chart_arg.starts_with("oci://")
            && !chart_arg.contains('/');
        if needs_resolution {
            // Resolve bare chart name via user's Helm repos only; do not use any hard-coded repositories.
            match Self::helm_search_repo_chart(&helm_bin, &chart_arg, version.as_ref()).await {
                Ok(Some(repo_chart)) => {
                    chart_arg = repo_chart;
                }
                Ok(None) => {
                    return Err(format!(
                        "Unable to resolve chart '{}'. Please specify repo/chart (e.g., metrics-server/metrics-server) or add the repo via 'helm repo add'.",
                        chart_arg
                    ));
                }
                Err(e) => return Err(e),
            }
        }

        // Prepare command
        let mut cmd = Command::new(&helm_bin);
        cmd.arg("upgrade");
        cmd.arg(&release_name);
        cmd.arg(&chart_arg);
        if let Some(ns) = target_ns.as_ref() {
            cmd.arg("--namespace").arg(ns);
        }
        if !context_name.trim().is_empty() {
            cmd.arg("--kube-context").arg(&context_name);
        }
        if reuse_values {
            cmd.arg("--reuse-values");
        }
        if let Some(ver) = version.as_ref() {
            if !ver.trim().is_empty() {
                cmd.arg("--version").arg(ver);
            }
        }

        // If values provided, write to a temp file and use -f
        let mut tmp_path: Option<std::path::PathBuf> = None;
        if let Some(v) = values.as_ref() {
            let sanitized_v = Self::expand_dotted_keys(v);
            let yaml_text = serde_yaml::to_string(&sanitized_v)
                .map_err(|e| format!("Failed to encode values to YAML: {}", e))?;
            let dir = std::env::temp_dir();
            let file_path = dir.join(format!("kumate-helm-values-{}.yaml", release_name));
            let mut file = File::create(&file_path)
                .await
                .map_err(|e| format!("Failed to create temp values file: {}", e))?;
            file.write_all(yaml_text.as_bytes())
                .await
                .map_err(|e| format!("Failed to write temp values file: {}", e))?;
            tmp_path = Some(file_path.clone());
            cmd.arg("-f").arg(file_path);
        }

        println!("Running helm upgrade command: {:?}", cmd);

        let out = cmd.output().await.map_err(|e| format!("Failed to run helm upgrade: {}", e))?;
        if out.status.success() {
            // Cleanup temp file
            if let Some(p) = tmp_path.as_ref() {
                let _ = tokio::fs::remove_file(p).await;
            }
            Ok("Upgrade successful".to_string())
        } else {
            let stderr = String::from_utf8_lossy(&out.stderr);
            if let Some(p) = tmp_path.as_ref() {
                let _ = tokio::fs::remove_file(p).await;
            }
            Err(format!("helm upgrade failed: {}", stderr.trim()))
        }
    }

    pub async fn rollback_release(
        context_name: String,
        namespace: Option<String>,
        release_name: String,
        revision: i32,
    ) -> Result<String, String> {
        let helm_bin = Self::resolve_helm_bin()
            .await
            .ok_or_else(|| "Helm CLI is not available; rollback requires Helm".to_string())?;

        // Resolve namespace
        let ns_hint = namespace.as_ref().map(|s| s.trim()).and_then(|s| {
            let lower = s.to_lowercase();
            let invalid = ["*", "all", "all namespaces", "all_namespaces"];
            if s.is_empty() || invalid.contains(&lower.as_str()) {
                None
            } else {
                Some(s)
            }
        });
        let mut target_ns: Option<String> = ns_hint.map(|s| s.to_string());
        if target_ns.is_none() {
            if let Ok(items) = Self::helm_cli_list_releases(&context_name, None).await {
                target_ns = items.into_iter().find_map(|item| {
                    let n = item.get("name").and_then(|x| x.as_str()).unwrap_or("");
                    if n == release_name {
                        item.get("namespace").and_then(|x| x.as_str()).map(|s| s.to_string())
                    } else {
                        None
                    }
                });
            }
        }

        let mut cmd = Command::new(&helm_bin);
        cmd.arg("rollback").arg(&release_name).arg(revision.to_string());
        if let Some(ns) = target_ns.as_ref() {
            cmd.arg("--namespace").arg(ns);
        }
        if !context_name.trim().is_empty() {
            cmd.arg("--kube-context").arg(&context_name);
        }

        let out = cmd.output().await.map_err(|e| format!("Failed to run helm rollback: {}", e))?;
        if out.status.success() {
            Ok("Rollback successful".to_string())
        } else {
            let stderr = String::from_utf8_lossy(&out.stderr);
            Err(format!("helm rollback failed: {}", stderr.trim()))
        }
    }

    pub async fn list_charts(_context_name: String) -> Result<Vec<Value>, String> {
        // Use Helm CLI to list charts from user's configured repositories. No hard-coded repos.
        let helm_bin = Self::resolve_helm_bin()
            .await
            .ok_or_else(|| "Helm CLI is not available; list charts requires Helm".to_string())?;

        let out = Command::new(&helm_bin)
            .arg("search")
            .arg("repo")
            .arg("-o")
            .arg("json")
            .output()
            .await
            .map_err(|e| format!("Failed to run 'helm search repo': {}", e))?;
        if !out.status.success() {
            let stderr = String::from_utf8_lossy(&out.stderr);
            return Err(format!("helm search repo failed: {}", stderr.trim()));
        }

        let stdout = String::from_utf8_lossy(&out.stdout);
        let v: Value = serde_json::from_str(stdout.trim())
            .map_err(|e| format!("Failed to parse 'helm search repo' JSON: {}", e))?;
        let mut results: Vec<Value> = Vec::new();
        if let Some(arr) = v.as_array() {
            for item in arr.iter() {
                let name = item.get("name").and_then(|x| x.as_str()).unwrap_or(""); // repo/chart
                let chart_version = item.get("version").and_then(|x| x.as_str()).unwrap_or("");
                let app_version = item.get("app_version").and_then(|x| x.as_str());
                let description = item.get("description").and_then(|x| x.as_str());
                // Provide a consumable reference in urls with the repo/chart string
                let urls = vec![name.to_string()];
                results.push(serde_json::json!({
                    "name": name,
                    "chart_version": chart_version,
                    "app_version": app_version,
                    "description": description,
                    "urls": urls,
                }));
            }
        }
        Ok(results)
    }

    // Try to resolve a chart reference using the user's local Helm repositories.
    // Returns a repo/chart string like "metrics-server/metrics-server" when found.
    async fn helm_search_repo_chart(
        helm_bin: &str,
        chart_name: &str,
        version: Option<&String>,
    ) -> Result<Option<String>, String> {
        // Query local Helm repos for chart candidates
        let mut cmd = Command::new(helm_bin);
        cmd.arg("search").arg("repo").arg(chart_name).arg("-o").arg("json").arg("--versions");
        let out =
            cmd.output().await.map_err(|e| format!("Failed to run 'helm search repo': {}", e))?;
        if !out.status.success() {
            // If search fails (e.g., no repos), just return None
            return Ok(None);
        }

        let stdout = String::from_utf8_lossy(&out.stdout);
        let results: Value = serde_json::from_str(stdout.trim())
            .map_err(|e| format!("Failed to parse 'helm search repo' JSON: {}", e))?;
        let arr = match results.as_array() {
            Some(a) => a,
            None => return Ok(None),
        };

        // Choose best candidate based on scoring:
        //  - Highest: exact pattern "<chart_name>/<chart_name>"
        //  - Medium: name ends with "/<chart_name>"
        //  - Low: name contains chart_name
        // Within the best score tier, prefer matching version if provided, otherwise pick the first.
        #[derive(Clone)]
        struct Candidate {
            name: String,
            version: String,
            score: i32,
        }
        let mut candidates: Vec<Candidate> = Vec::new();
        for item in arr.iter() {
            let name = item.get("name").and_then(|x| x.as_str()).unwrap_or("");
            let ver = item.get("version").and_then(|x| x.as_str()).unwrap_or("");
            let exact = name == format!("{}/{}", chart_name, chart_name);
            let ends = name.ends_with(&format!("/{chart_name}"));
            let contains = name.contains(chart_name);
            let score = if exact {
                3
            } else if ends {
                2
            } else if contains {
                1
            } else {
                0
            };
            if score > 0 {
                candidates.push(Candidate {
                    name: name.to_string(),
                    version: ver.to_string(),
                    score,
                });
            }
        }
        if candidates.is_empty() {
            return Ok(None);
        }
        // Determine the highest score tier
        let max_score = candidates.iter().map(|c| c.score).max().unwrap_or(1);
        let best: Vec<Candidate> =
            candidates.into_iter().filter(|c| c.score == max_score).collect();
        if let Some(want_ver) = version {
            if let Some(found) = best.iter().find(|c| &c.version == want_ver) {
                return Ok(Some(found.name.clone()));
            }
        }
        // Fallback: pick the first from the best tier
        Ok(best.first().map(|c| c.name.clone()))
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

    // Expand keys containing dots into nested maps for YAML values files.
    // Example: {"metrics-server.hostNetwork": true} -> {"metrics-server": {"hostNetwork": true}}
    fn expand_dotted_keys(value: &Value) -> Value {
        match value {
            Value::Object(obj) => {
                let mut new_map: serde_json::Map<String, Value> = serde_json::Map::new();
                for (k, v) in obj.iter() {
                    let expanded_v = Self::expand_dotted_keys(v);
                    if k.contains('.') {
                        let parts: Vec<&str> = k.split('.').collect();
                        Self::insert_nested(&mut new_map, &parts, expanded_v);
                    } else {
                        if let Some(existing) = new_map.get_mut(k) {
                            if existing.is_object() && expanded_v.is_object() {
                                let existing_obj = existing.as_object_mut().unwrap();
                                let expanded_obj = expanded_v.as_object().unwrap();
                                Self::merge_maps(existing_obj, expanded_obj);
                            } else {
                                *existing = expanded_v;
                            }
                        } else {
                            new_map.insert(k.clone(), expanded_v);
                        }
                    }
                }
                Value::Object(new_map)
            }
            Value::Array(arr) => {
                Value::Array(arr.iter().map(|x| Self::expand_dotted_keys(x)).collect())
            }
            _ => value.clone(),
        }
    }

    fn insert_nested(map: &mut serde_json::Map<String, Value>, parts: &[&str], val: Value) {
        if parts.is_empty() {
            return;
        }
        if parts.len() == 1 {
            let key = parts[0].to_string();
            if let Some(existing) = map.get_mut(&key) {
                if existing.is_object() && val.is_object() {
                    let existing_obj = existing.as_object_mut().unwrap();
                    let val_obj = val.as_object().unwrap();
                    Self::merge_maps(existing_obj, val_obj);
                } else {
                    *existing = val;
                }
            } else {
                map.insert(key, val);
            }
            return;
        }
        let head = parts[0].to_string();
        let rest = &parts[1..];
        let entry = map.entry(head).or_insert(Value::Object(serde_json::Map::new()));
        if !entry.is_object() {
            *entry = Value::Object(serde_json::Map::new());
        }
        let sub_map = entry.as_object_mut().unwrap();
        Self::insert_nested(sub_map, rest, val);
    }

    fn merge_maps(
        target: &mut serde_json::Map<String, Value>,
        src: &serde_json::Map<String, Value>,
    ) {
        for (k, v) in src.iter() {
            if let Some(existing) = target.get_mut(k) {
                if existing.is_object() && v.is_object() {
                    let existing_obj = existing.as_object_mut().unwrap();
                    let v_obj = v.as_object().unwrap();
                    Self::merge_maps(existing_obj, v_obj);
                } else {
                    *existing = v.clone();
                }
            } else {
                target.insert(k.clone(), v.clone());
            }
        }
    }
}
