use std::{fs::FileType, path::PathBuf};

use base64::{engine::general_purpose::STANDARD, Engine};
// k8s-openapi 0.27 dropped its chrono re-export in favour of jiff.
use jiff::Timestamp;
use serde::{Deserialize, Serialize};
use tokio::fs::{read_dir, ReadDir};
use uuid::Uuid;

use crate::{state::AppState, types::k8s_contexts::K8sContext, utils::crypto::Crypto};
// image 0.25 removed `ImageOutputFormat`; `write_to` takes an `ImageFormat` now.
use image::{imageops::FilterType, GenericImageView, ImageFormat};
use std::io::Cursor;

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
// The `cluster` / `user` blocks are carried through verbatim rather than modelled, so
// they need a dynamic value type. serde-saphyr deliberately has no `Value` of its own —
// it deserializes straight into your types with no intermediate tree — and the type it
// documents for this case is `serde_json::Value`, driven through `deserialize_any`.
// Nothing downstream inspects these: they are read from one kubeconfig and written into
// another, so a JSON-shaped intermediate is transparent. The one YAML-specific thing that
// would not survive is a non-string mapping key, which kubeconfig never has.
//
// One cosmetic difference from serde_yaml::Value: `serde_json::Value::Object` is a
// `BTreeMap`, so keys inside these blocks come back out alphabetically rather than in
// their original file order. YAML mappings are unordered, so nothing that reads the
// result cares — but a diff of the generated kubeconfig against the source will.
#[derive(Deserialize, Clone)]
pub struct KCNamedCluster {
    pub name: String,
    pub cluster: serde_json::Value,
}
#[derive(Deserialize, Clone)]
pub struct KCNamedUser {
    pub name: String,
    pub user: serde_json::Value,
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
    pub cluster: serde_json::Value,
}
#[derive(Serialize)]
pub struct OutNamedUser {
    pub name: String,
    pub user: serde_json::Value,
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
    // Recursively collect kubeconfig file paths inside ~/.kube
    // We consider files named "config" or ending with .yaml/.yml
    async fn collect_kubeconfig_paths(root: &PathBuf) -> Result<Vec<PathBuf>, String> {
        let mut out: Vec<PathBuf> = Vec::new();
        let mut stack: Vec<PathBuf> = vec![root.clone()];

        while let Some(dir) = stack.pop() {
            let mut rd: ReadDir = match read_dir(&dir).await {
                Ok(r) => r,
                Err(_) => continue, // skip unreadable directories
            };

            while let Some(entry) = rd.next_entry().await.map_err(|e| e.to_string())? {
                let ft: FileType = entry.file_type().await.map_err(|e| e.to_string())?;
                let path: PathBuf = entry.path();
                if ft.is_dir() {
                    stack.push(path);
                    continue;
                }
                if ft.is_file() {
                    let fname: &str = path.file_name().and_then(|s| s.to_str()).unwrap_or("");
                    // Support kubeconfig variants commonly stored under ~/.kube
                    // e.g. config, config.local, config.ndd001, config.* as well as *.yaml/*.yml
                    if fname == "config"
                        || fname.starts_with("config.")
                        || fname.ends_with(".yaml")
                        || fname.ends_with(".yml")
                    {
                        out.push(path);
                    }
                }
            }
        }

        Ok(out)
    }
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
        let paths = Self::collect_kubeconfig_paths(&kube_dir)
            .await
            .map_err(|_| "~/.kube not found".to_string())?;

        for path in paths.into_iter() {
            let content = match tokio::fs::read_to_string(&path).await {
                Ok(s) => s,
                Err(_) => continue,
            };
            let raw: KubeConfigRaw = match serde_saphyr::from_str(&content) {
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
            let cluster_entry = clusters
                .iter()
                .find(|c| c.name == nc.context.cluster)
                .cloned();
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
            let yaml = serde_saphyr::to_string(&out).map_err(|e| e.to_string())?;
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

        let paths = match Self::collect_kubeconfig_paths(&kube_dir).await {
            Ok(v) => v,
            Err(_) => return Ok(0),
        };
        let crypto: Option<Crypto> = Crypto::init().ok();

        for path in paths.into_iter() {
            let content: String = match tokio::fs::read_to_string(&path).await {
                Ok(s) => s,
                Err(_) => continue,
            };
            let raw: KubeConfigRaw = match serde_saphyr::from_str(&content) {
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

                let cluster_entry: Option<KCNamedCluster> = clusters
                    .iter()
                    .find(|c| c.name == nc.context.cluster)
                    .cloned();
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
                let yaml: String = serde_saphyr::to_string(&out).map_err(|e| e.to_string())?;

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
                        display_name: None,
                        cluster: Some(nc.context.cluster.clone()),
                        user: nc.context.user.clone(),
                        avatar: None,
                        created_at: Timestamp::now().as_second(),
                    })
                    .map_err(|e| e.to_string())?;

                imported += 1;
            }
        }

        Ok(imported)
    }

    pub fn list_contexts(app_state: &AppState) -> Result<Vec<K8sContext>, String> {
        app_state
            .k8s_contexts
            .list_contexts()
            .map_err(|e| e.to_string())
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
            display_name: None,
            cluster,
            user,
            avatar: None,
            // `as_second()` is jiff's spelling of chrono's `timestamp()`: Unix epoch
            // seconds as `i64`, which is what `K8sContext::created_at` already stores.
            created_at: Timestamp::now().as_second(),
        };
        app_state
            .k8s_contexts
            .add_context(&ctx)
            .map_err(|e| e.to_string())
    }

    pub fn update_context_metadata(
        app_state: &AppState,
        name: String,
        display_name: Option<String>,
        avatar_b64: Option<String>,
    ) -> Result<K8sContext, String> {
        // Decode base64 avatar if provided, then process and encode to WebP (square, cover)
        let avatar_bytes: Option<Vec<u8>> = if let Some(b64) = avatar_b64 {
            // Empty string means clear avatar
            if b64.is_empty() {
                Some(Vec::new())
            } else {
                let raw: Vec<u8> = base64::engine::general_purpose::STANDARD
                    .decode(b64)
                    .map_err(|e| format!("invalid avatar base64: {}", e))?;

                // Downscale to a square avatar sized for the 36px UI slot (no 2x retina buffer).
                const AVATAR_SIZE: u32 = 36;

                let img = image::load_from_memory(&raw)
                    .map_err(|e| format!("cannot decode image: {}", e))?;
                // Get original dimensions
                let (w, h) = img.dimensions();
                // Center-crop to square (cover behavior)
                let side = w.min(h);
                let x = (w - side) / 2;
                let y = (h - side) / 2;
                let cropped = img.crop_imm(x, y, side, side);
                // Resize to target size with high-quality filter
                let resized = cropped.resize_exact(AVATAR_SIZE, AVATAR_SIZE, FilterType::Lanczos3);

                let mut out: Vec<u8> = Vec::new();
                let mut cursor = Cursor::new(&mut out);
                // image 0.25 replaced `ImageOutputFormat` with `ImageFormat` on `write_to`.
                // The writer bound is `Write + Seek`, which `Cursor<&mut Vec<u8>>` satisfies.
                // Still no quality knob: the bundled WebP encoder is lossless-only, so a
                // 36x36 avatar comes out a little larger than a lossy encode would and
                // there is nothing to tune. (`write_with_encoder(WebPEncoder::new_lossless)`
                // is the same bytes without the `Seek` bound, if that ever matters.)
                resized
                    .write_to(&mut cursor, ImageFormat::WebP)
                    .map_err(|e| format!("cannot encode webp: {}", e))?;
                Some(out)
            }
        } else {
            None
        };
        app_state
            .k8s_contexts
            .update_context_fields(&name, display_name, avatar_bytes)
            .map_err(|e| e.to_string())
    }
}
