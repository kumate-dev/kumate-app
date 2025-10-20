use std::path::PathBuf;

use k8s_openapi::Resource as K8sResource;
use kube::config::{Config, KubeConfigOptions, Kubeconfig};
use kube::core::NamespaceResourceScope;
use kube::{Api, Client, Resource};

use crate::k8s::contexts::K8sContexts;

pub struct K8sClient;

impl K8sClient {
    pub async fn api<K>(client: Client, namespace: Option<String>) -> Api<K>
    where
        K: Resource<DynamicType = (), Scope = NamespaceResourceScope> + K8sResource + Clone,
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
        let (kubeconfig, _token) = K8sContexts::get_context_secrets(name).await?;

        let sanitized: String = Self::sanitize_yaml(&kubeconfig);

        if let Some(client) = Self::try_client_from_custom(&sanitized, name).await? {
            return Ok(client);
        }

        Self::client_from_default_with_temp(name, &sanitized).await
    }

    fn sanitize_yaml(s: &str) -> String {
        s.chars()
            .filter(|&c| match c {
                '\n' | '\r' | '\t' => true,
                _ => !c.is_control(),
            })
            .collect()
    }

    async fn try_client_from_custom(sanitized: &str, name: &str) -> Result<Option<Client>, String> {
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
                            println!("client_from_context: Client::try_from error: {}", e);
                            Ok(None)
                        }
                    },
                    Err(e) => {
                        println!("client_from_context: from_custom_kubeconfig error: {}", e);
                        Ok(None)
                    }
                }
            }
            Err(e) => {
                println!(
                    "client_from_context: serde_yaml->Kubeconfig parse error: {}",
                    e
                );
                Ok(None)
            }
        }
    }

    async fn client_from_default_with_temp(name: &str, sanitized: &str) -> Result<Client, String> {
        let tmp_path: PathBuf = std::env::temp_dir().join(format!("kumate_ctx_{}.yaml", name));
        tokio::fs::write(&tmp_path, sanitized)
            .await
            .map_err(|e| e.to_string())?;

        let old_kubeconfig: Option<String> = std::env::var("KUBECONFIG").ok();
        std::env::set_var("KUBECONFIG", &tmp_path);

        let result: Result<Client, String> = Client::try_default().await.map_err(|e| e.to_string());

        match old_kubeconfig {
            Some(v) => std::env::set_var("KUBECONFIG", v),
            None => std::env::remove_var("KUBECONFIG"),
        }

        result
    }
}
