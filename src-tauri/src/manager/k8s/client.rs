use std::path::PathBuf;

use k8s_openapi::{Metadata, Resource as K8sResource};
use kube::api::ObjectMeta;
use kube::config::{Config, KubeConfigOptions, Kubeconfig};
use kube::core::NamespaceResourceScope;
use kube::{Api, Client, Resource};

use crate::manager::k8s::contexts::K8sContexts;
use crate::utils::connections::ConnectionsManager;

pub struct K8sClient;

impl K8sClient {
    // Ensure common locations for CLI auth plugins (e.g., aws) are on PATH.
    // This helps when the app is launched from a GUI where PATH is limited.
    fn ensure_exec_plugin_path_env() {
        use std::env;
        let mut current = env::var("PATH").unwrap_or_default();
        // Common Homebrew and legacy locations on macOS/Linux
        let candidates = vec!["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"];
        let sep = if cfg!(windows) { ";" } else { ":" };

        let mut added = false;
        for p in candidates {
            if !current.split(sep).any(|s| s == p) {
                if current.is_empty() {
                    current = p.to_string();
                } else {
                    current.push_str(sep);
                    current.push_str(p);
                }
                added = true;
            }
        }

        // Windows default AWS CLI install path
        if cfg!(windows) {
            // Use a raw string for Windows path to avoid escaping issues
            let win_candidate: &str = r#"C:\Program Files\Amazon\AWSCLI\bin"#;
            if !current.split(sep).any(|s| s == win_candidate) {
                if current.is_empty() {
                    current = win_candidate.to_string();
                } else {
                    current.push_str(sep);
                    current.push_str(win_candidate);
                }
                added = true;
            }
        }

        if added {
            let _ = env::set_var("PATH", current);
        }
    }
    pub async fn api<K>(client: Client, namespace: Option<String>) -> Api<K>
    where
        K: Resource<DynamicType = (), Scope = NamespaceResourceScope>
            + K8sResource
            + Metadata<Ty = ObjectMeta>
            + Clone
            + serde::de::DeserializeOwned,
    {
        match namespace.as_ref().map(|s| s.trim().to_lowercase()) {
            None => Api::all(client),
            Some(ns) if ns.is_empty() || ns == "*" || ns == "all" || ns == "all namespaces" => {
                Api::all(client)
            }
            Some(ns) => Api::namespaced(client, &ns),
        }
    }

    pub async fn for_context(name: &str) -> Result<Client, String> {
        // Check connection gating first; if disconnected, block all requests to this cluster
        let cm = ConnectionsManager::global();
        if !cm.is_connected(name).await {
            return Err("cluster is disconnected".to_string());
        }

        // Make sure PATH includes common locations, so auth exec plugins like 'aws' are resolvable.
        // This particularly helps for EKS contexts when the app is launched from Finder/Start Menu.
        Self::ensure_exec_plugin_path_env();

        let (kubeconfig, _token) = K8sContexts::get_context_secrets(name).await?;

        let sanitized: String = Self::sanitize_yaml(&kubeconfig);

        let mut errs: Vec<String> = Vec::new();
        if let Some(client) = Self::try_client_from_custom(&sanitized, name, &mut errs).await? {
            return Ok(client);
        }

        match Self::client_from_default_with_temp(name, &sanitized).await {
            Ok(c) => Ok(c),
            Err(msg) => {
                if errs.is_empty() {
                    Err(msg)
                } else {
                    Err(format!("{}\n{}", errs.join("\n"), msg))
                }
            }
        }
    }

    fn sanitize_yaml(s: &str) -> String {
        s.chars()
            .filter(|&c| match c {
                '\n' | '\r' | '\t' => true,
                _ => !c.is_control(),
            })
            .collect()
    }

    async fn try_client_from_custom(
        sanitized: &str,
        name: &str,
        errs: &mut Vec<String>,
    ) -> Result<Option<Client>, String> {
        match serde_yaml::from_str::<Kubeconfig>(sanitized) {
            Ok(kcfg) => {
                let opts = KubeConfigOptions {
                    context: Some(name.to_string()),
                    ..Default::default()
                };
                match Config::from_custom_kubeconfig(kcfg, &opts).await {
                    Ok(cfg) => match Client::try_from(cfg) {
                        Ok(c) => Ok(Some(c)),
                        Err(e) => {
                            let msg = format!("client_from_context: Client::try_from error: {}", e);
                            println!("{}", msg);
                            errs.push(msg);
                            Ok(None)
                        }
                    },
                    Err(e) => {
                        let msg =
                            format!("client_from_context: from_custom_kubeconfig error: {}", e);
                        println!("{}", msg);
                        errs.push(msg);
                        Ok(None)
                    }
                }
            }
            Err(e) => {
                let msg = format!("client_from_context: serde_yaml->Kubeconfig parse error: {}", e);
                println!("{}", msg);
                errs.push(msg);
                Ok(None)
            }
        }
    }

    async fn client_from_default_with_temp(name: &str, sanitized: &str) -> Result<Client, String> {
        let tmp_path: PathBuf = std::env::temp_dir().join(format!("kumate_ctx_{}.yaml", name));
        tokio::fs::write(&tmp_path, sanitized).await.map_err(|e| e.to_string())?;

        let old_kubeconfig: Option<String> = std::env::var("KUBECONFIG").ok();
        std::env::set_var("KUBECONFIG", &tmp_path);

        let result: Result<Client, String> = Client::try_default().await.map_err(|e| e.to_string());

        match old_kubeconfig {
            Some(v) => std::env::set_var("KUBECONFIG", v),
            None => std::env::remove_var("KUBECONFIG"),
        }

        result
    }

    /// Check connectivity to a context by querying the apiserver version.
    /// Performs a bounded wait to avoid hanging the UI.
    pub async fn check_context_connection(name: &str) -> Result<(), String> {
        use tokio::time::{timeout, Duration};
        match timeout(Duration::from_secs(10), async move {
            let client = Self::for_context(name).await?;
            client.apiserver_version().await.map(|_| ()).map_err(|e| e.to_string())
        })
        .await
        {
            Ok(Ok(())) => Ok(()),
            Ok(Err(e)) => Err(e),
            Err(_) => Err("Connection check timed out".to_string()),
        }
    }

    /// Retrieve the git version string for the given context by calling apiserver_version.
    /// Performs a bounded wait to avoid hanging the UI.
    pub async fn get_context_version(name: &str) -> Result<String, String> {
        use tokio::time::{timeout, Duration};
        match timeout(Duration::from_secs(10), async move {
            let client = Self::for_context(name).await?;
            client.apiserver_version().await.map(|v| v.git_version).map_err(|e| e.to_string())
        })
        .await
        {
            Ok(Ok(ver)) => Ok(ver),
            Ok(Err(e)) => Err(e),
            Err(_) => Err("Connection check timed out".to_string()),
        }
    }
}
