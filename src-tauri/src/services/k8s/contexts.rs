use std::{fs::FileType, path::PathBuf};

use base64::{engine::general_purpose::STANDARD, Engine};
use k8s_openapi::chrono::Utc;
use serde::{Deserialize, Serialize};
use tokio::fs::{read_dir, ReadDir};
use uuid::Uuid;

use crate::{state::AppState, types::k8s_contexts::K8sContext, utils::crypto::Crypto};

#[derive(Deserialize, Clone)]
pub struct KCNamedContext {
    pub name: String,
    pub context: KCContextRef,
}
#[derive(Deserialize, Serialize, Clone)]
pub struct KCContextRef {
    pub cluster: String,
    pub user: Option<String>,
    pub namespace: Option<String>,
}
#[derive(Deserialize, Clone)]
pub struct KCNamedCluster {
    pub name: String,
    pub cluster: serde_yaml::Value,
}
#[derive(Deserialize, Clone)]
pub struct KCNamedUser {
    pub name: String,
    pub user: serde_yaml::Value,
}
#[derive(Deserialize, Clone)]
pub struct KubeConfigRaw {
    pub contexts: Option<Vec<KCNamedContext>>,
    pub clusters: Option<Vec<KCNamedCluster>>,
    pub users: Option<Vec<KCNamedUser>>,
}

#[derive(Serialize)]
pub struct OutNamedContext {
    pub name: String,
    pub context: KCContextRef,
}
#[derive(Serialize)]
pub struct OutNamedCluster {
    pub name: String,
    pub cluster: serde_yaml::Value,
}
#[derive(Serialize)]
pub struct OutNamedUser {
    pub name: String,
    pub user: serde_yaml::Value,
}
#[derive(Serialize)]
pub struct KubeConfigOut {
    pub api_version: String,
    pub kind: String,
    #[serde(rename = "current-context")]
    pub current_context: String,
    pub contexts: Vec<OutNamedContext>,
    pub clusters: Vec<OutNamedCluster>,
    pub users: Vec<OutNamedUser>,
}

pub struct K8sContexts;

impl K8sContexts {
    pub async fn get_context_secrets(name: &str) -> Result<(String, String), String> {
        let crypto: Crypto = Crypto::init().map_err(|e| e.to_string())?;
        let kc_key = format!("ctx:{}:kubeconfig", name);
        let token_key = format!("ctx:{}:token", name);

        if let Some((kc, token)) = Self::try_read_secrets(&crypto, &kc_key, &token_key)? {
            return Ok((kc, token));
        }

        let kc = Self::build_kubeconfig_from_home(name).await?;
        let token = "".to_string();
        Self::persist_secrets(&crypto, &kc_key, &token_key, &kc, &token);

        Ok((kc, token))
    }

    fn try_read_secrets(
        crypto: &Crypto,
        kc_key: &str,
        token_key: &str,
    ) -> Result<Option<(String, String)>, String> {
        match (crypto.secrets_get(kc_key), crypto.secrets_get(token_key)) {
            (Ok(kc_b64), Ok(token_b64)) => {
                let kc_bytes = STANDARD.decode(kc_b64).map_err(|e| e.to_string())?;
                let token_bytes = STANDARD.decode(token_b64).map_err(|e| e.to_string())?;
                let kc_pt = crypto.decrypt(&kc_bytes).map_err(|e| e.to_string())?;
                let token_pt = crypto.decrypt(&token_bytes).map_err(|e| e.to_string())?;
                let kc = String::from_utf8(kc_pt).map_err(|e| e.to_string())?;
                let token = String::from_utf8(token_pt).map_err(|e| e.to_string())?;
                Ok(Some((kc, token)))
            }
            _ => Ok(None),
        }
    }

    async fn build_kubeconfig_from_home(name: &str) -> Result<String, String> {
        let home = dirs::home_dir().ok_or_else(|| "home dir not found".to_string())?;
        let kube_dir = home.join(".kube");
        let mut rd: ReadDir =
            read_dir(&kube_dir).await.map_err(|_| "~/.kube not found".to_string())?;

        while let Some(entry) = rd.next_entry().await.map_err(|e| e.to_string())? {
            let ft: FileType = entry.file_type().await.map_err(|e| e.to_string())?;
            if !ft.is_file() {
                continue;
            }
            let path = entry.path();
            let fname = path.file_name().and_then(|s| s.to_str()).unwrap_or("");
            if !(fname == "config" || fname.ends_with(".yaml") || fname.ends_with(".yml")) {
                continue;
            }
            let content = match tokio::fs::read_to_string(&path).await {
                Ok(s) => s,
                Err(_) => continue,
            };
            let raw: KubeConfigRaw = match serde_yaml::from_str(&content) {
                Ok(v) => v,
                Err(_) => continue,
            };
            let contexts = match raw.contexts {
                Some(v) => v,
                None => continue,
            };
            let clusters = raw.clusters.unwrap_or_default();
            let users = raw.users.unwrap_or_default();

            if let Some(yaml) =
                Self::build_minimal_yaml_for_context(name, &contexts, &clusters, &users)?
            {
                return Ok(yaml);
            }
        }

        Err("kubeconfig for context not found in ~/.kube".to_string())
    }

    fn build_minimal_yaml_for_context(
        name: &str,
        contexts: &Vec<KCNamedContext>,
        clusters: &Vec<KCNamedCluster>,
        users: &Vec<KCNamedUser>,
    ) -> Result<Option<String>, String> {
        for nc in contexts {
            if nc.name != name {
                continue;
            }
            let cluster_entry = clusters.iter().find(|c| c.name == nc.context.cluster).cloned();
            let user_entry = nc
                .context
                .user
                .as_ref()
                .and_then(|uname| users.iter().find(|u| u.name == *uname).cloned());

            let out_ctx = OutNamedContext {
                name: name.to_string(),
                context: nc.context.clone(),
            };
            let mut out_clusters = Vec::new();
            if let Some(c) = cluster_entry {
                out_clusters.push(OutNamedCluster {
                    name: c.name,
                    cluster: c.cluster,
                });
            }
            let mut out_users = Vec::new();
            if let Some(u) = user_entry {
                out_users.push(OutNamedUser {
                    name: u.name,
                    user: u.user,
                });
            }

            let out = KubeConfigOut {
                api_version: "v1".to_string(),
                kind: "Config".to_string(),
                current_context: name.to_string(),
                contexts: vec![out_ctx],
                clusters: out_clusters,
                users: out_users,
            };
            let yaml = serde_yaml::to_string(&out).map_err(|e| e.to_string())?;
            return Ok(Some(yaml));
        }
        Ok(None)
    }

    fn persist_secrets(crypto: &Crypto, kc_key: &str, token_key: &str, kc: &str, token: &str) {
        if let Ok(kc_enc) = crypto.encrypt(kc.as_bytes()) {
            let kc_b64 = STANDARD.encode(kc_enc);
            let _ = crypto.secrets_set(kc_key, &kc_b64);
        }
        if let Ok(token_enc) = crypto.encrypt(token.as_bytes()) {
            let token_b64 = STANDARD.encode(token_enc);
            let _ = crypto.secrets_set(token_key, &token_b64);
        }
    }

    pub async fn import_from_home(app_state: &AppState) -> Result<usize, String> {
        let home: PathBuf = dirs::home_dir().ok_or_else(|| "home dir not found".to_string())?;
        let kube_dir: PathBuf = home.join(".kube");
        let mut imported: usize = 0usize;

        let existing: Vec<String> = app_state
            .k8s_contexts
            .list_contexts()
            .map_err(|e| e.to_string())?
            .into_iter()
            .map(|c| c.name)
            .collect();
        let mut rd: ReadDir = match read_dir(&kube_dir).await {
            Ok(r) => r,
            Err(_) => return Ok(0),
        };
        let crypto: Option<Crypto> = Crypto::init().ok();

        while let Some(entry) = rd.next_entry().await.map_err(|e| e.to_string())? {
            let ft: FileType = entry.file_type().await.map_err(|e| e.to_string())?;
            if !ft.is_file() {
                continue;
            }
            let path: PathBuf = entry.path();
            let fname: &str = path.file_name().and_then(|s| s.to_str()).unwrap_or("");
            if !(fname == "config" || fname.ends_with(".yaml") || fname.ends_with(".yml")) {
                continue;
            }

            let content: String = match tokio::fs::read_to_string(&path).await {
                Ok(s) => s,
                Err(_) => continue,
            };
            let raw: KubeConfigRaw = match serde_yaml::from_str(&content) {
                Ok(v) => v,
                Err(_) => continue,
            };
            let contexts: Vec<KCNamedContext> = match raw.contexts {
                Some(v) => v,
                None => continue,
            };
            let clusters: Vec<KCNamedCluster> = raw.clusters.unwrap_or_default();
            let users: Vec<KCNamedUser> = raw.users.unwrap_or_default();

            for nc in contexts.iter() {
                let name: String = nc.name.clone();
                if existing.iter().any(|e| e == &name) {
                    continue;
                }

                let cluster_entry: Option<KCNamedCluster> =
                    clusters.iter().find(|c| c.name == nc.context.cluster).cloned();
                let user_entry: Option<KCNamedUser> = nc
                    .context
                    .user
                    .as_ref()
                    .and_then(|uname| users.iter().find(|u| u.name == *uname).cloned());

                let out_ctx: OutNamedContext = OutNamedContext {
                    name: name.clone(),
                    context: nc.context.clone(),
                };
                let mut out_clusters: Vec<OutNamedCluster> = Vec::new();
                if let Some(c) = cluster_entry {
                    out_clusters.push(OutNamedCluster {
                        name: c.name,
                        cluster: c.cluster,
                    });
                }
                let mut out_users = Vec::new();
                if let Some(u) = user_entry {
                    out_users.push(OutNamedUser {
                        name: u.name,
                        user: u.user,
                    });
                }

                let out: KubeConfigOut = KubeConfigOut {
                    api_version: "v1".to_string(),
                    kind: "Config".to_string(),
                    current_context: name.clone(),
                    contexts: vec![out_ctx],
                    clusters: out_clusters,
                    users: out_users,
                };
                let yaml: String = serde_yaml::to_string(&out).map_err(|e| e.to_string())?;

                if let Some(crypto) = &crypto {
                    if let Ok(kc_enc) = crypto.encrypt(yaml.as_bytes()) {
                        let kc_b64 = STANDARD.encode(kc_enc);
                        let _ = crypto.secrets_set(&format!("ctx:{}:kubeconfig", name), &kc_b64);
                    }
                    if let Ok(token_enc) = crypto.encrypt("".as_bytes()) {
                        let token_b64 = STANDARD.encode(token_enc);
                        let _ = crypto.secrets_set(&format!("ctx:{}:token", name), &token_b64);
                    }
                }

                app_state
                    .k8s_contexts
                    .add_context(&K8sContext {
                        id: Uuid::new_v4().to_string(),
                        name: name.clone(),
                        cluster: Some(nc.context.cluster.clone()),
                        user: nc.context.user.clone(),
                        avatar: None,
                        created_at: Utc::now().timestamp(),
                    })
                    .map_err(|e| e.to_string())?;

                imported += 1;
            }
        }

        Ok(imported)
    }

    pub fn list_contexts(app_state: &AppState) -> Result<Vec<K8sContext>, String> {
        app_state.k8s_contexts.list_contexts().map_err(|e| e.to_string())
    }

    pub fn _add_context(
        app_state: &AppState,
        name: String,
        cluster: Option<String>,
        user: Option<String>,
    ) -> Result<(), String> {
        let id: String = Uuid::new_v4().to_string();
        let ctx: K8sContext = K8sContext {
            id,
            name: name.clone(),
            cluster,
            user,
            avatar: None,
            created_at: Utc::now().timestamp(),
        };
        app_state.k8s_contexts.add_context(&ctx).map_err(|e| e.to_string())
    }
}
