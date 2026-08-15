//! Kubernetes client construction and caching.
//!
//! Building a client is expensive: it re-reads the app key file, decrypts the
//! stored kubeconfig, parses YAML, and negotiates TLS — and for exec-auth
//! contexts (EKS, GKE) it may shell out to an auth plugin. The previous
//! implementation did all of that on *every single command and every watch*,
//! which dominated startup and made large clusters feel sluggish.
//!
//! [`ClientRegistry`] caches the built [`Client`] per context. `kube` refreshes
//! exec/OIDC credentials internally on the auth layer, so a cached client stays
//! valid; the TTL exists only so that an edited kubeconfig is eventually picked
//! up without restarting the app.
//!
//! The registry is a process-global because `for_context` is called from ~200
//! static call sites that have no access to `AppHandle`/`State`. It is wired
//! into `AppState` for observability, but the global is the source of truth.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, OnceLock};
use std::time::{Duration, Instant};

use k8s_openapi::{Metadata, Resource as K8sResource};
use kube::api::ObjectMeta;
use kube::config::{Config, KubeConfigOptions, Kubeconfig};
use kube::core::NamespaceResourceScope;
use kube::{Api, Client, Resource};
use tokio::sync::{Mutex, RwLock};

use crate::error::{redact, AppError, AppResult};
use crate::manager::k8s::contexts::K8sContexts;
use crate::utils::connections::ConnectionsManager;

/// How long a built client is reused before it is rebuilt from the stored
/// kubeconfig. Not a credential lifetime — `kube` handles token refresh itself.
const CLIENT_TTL: Duration = Duration::from_secs(30 * 60);

/// Bounded wait for apiserver reachability probes, so the UI never hangs.
const PROBE_TIMEOUT: Duration = Duration::from_secs(10);

struct CachedClient {
    client: Client,
    built_at: Instant,
}

#[derive(Default)]
pub struct ClientRegistry {
    clients: RwLock<HashMap<String, CachedClient>>,
    /// Per-context build locks, so N concurrent commands against a cold context
    /// trigger one client build instead of N. Without this, opening a cluster
    /// fires an auth-plugin exec per in-flight request.
    build_locks: Mutex<HashMap<String, Arc<Mutex<()>>>>,
}

impl ClientRegistry {
    pub fn global() -> &'static ClientRegistry {
        static REGISTRY: OnceLock<ClientRegistry> = OnceLock::new();
        REGISTRY.get_or_init(ClientRegistry::default)
    }

    async fn get_cached(&self, context: &str) -> Option<Client> {
        let clients = self.clients.read().await;
        clients
            .get(context)
            .and_then(|entry| (entry.built_at.elapsed() < CLIENT_TTL).then(|| entry.client.clone()))
    }

    async fn store(&self, context: String, client: Client) {
        self.clients.write().await.insert(
            context,
            CachedClient {
                client,
                built_at: Instant::now(),
            },
        );
    }

    async fn build_lock(&self, context: &str) -> Arc<Mutex<()>> {
        let mut locks = self.build_locks.lock().await;
        Arc::clone(locks.entry(context.to_string()).or_default())
    }

    /// Drop the cached client for a context. Call this whenever the stored
    /// kubeconfig changes or the user disconnects the cluster.
    pub async fn invalidate(&self, context: &str) {
        self.clients.write().await.remove(context);
        self.build_locks.lock().await.remove(context);
    }

    pub async fn invalidate_all(&self) {
        self.clients.write().await.clear();
        self.build_locks.lock().await.clear();
    }

    pub async fn cached_contexts(&self) -> usize {
        self.clients.read().await.len()
    }
}

pub struct K8sClient;

impl K8sClient {
    /// Ensure common locations for CLI auth plugins (e.g. `aws`, `gke-gcloud-auth-plugin`)
    /// are on `PATH`. Needed when the app is launched from Finder/Start Menu, where
    /// the inherited `PATH` is minimal.
    ///
    /// Runs exactly once per process: mutating `PATH` repeatedly from multiple
    /// threads is a data race, and the previous code did it on every client build.
    fn ensure_exec_plugin_path_env() {
        static ONCE: OnceLock<()> = OnceLock::new();
        ONCE.get_or_init(|| {
            use std::env;

            let sep = if cfg!(windows) { ";" } else { ":" };
            let mut current = env::var("PATH").unwrap_or_default();
            let mut added = false;

            let mut candidates: Vec<&str> =
                vec!["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"];
            if cfg!(windows) {
                candidates.push(r#"C:\Program Files\Amazon\AWSCLI\bin"#);
            }

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

            if added {
                // SAFETY-ish: single-shot, before any watcher tasks are spawned.
                env::set_var("PATH", current);
            }
        });
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

    /// Get a client for `context`, from cache when possible.
    pub async fn for_context(context: &str) -> AppResult<Client> {
        Self::client_for(context, false).await
    }

    /// Get a client for `context`, always rebuilt from the stored kubeconfig.
    /// Used by connectivity probes, where a stale cached client would mask a
    /// credential or network problem.
    pub async fn for_context_fresh(context: &str) -> AppResult<Client> {
        Self::client_for(context, true).await
    }

    async fn client_for(context: &str, force_rebuild: bool) -> AppResult<Client> {
        // Connection gating first: a disconnected cluster must issue no traffic.
        if !ConnectionsManager::global().is_connected(context).await {
            return Err(AppError::Disconnected {
                context: context.to_string(),
            });
        }

        let registry = ClientRegistry::global();

        if force_rebuild {
            registry.invalidate(context).await;
        } else if let Some(client) = registry.get_cached(context).await {
            return Ok(client);
        }

        // Serialize builds per context so concurrent callers share one build.
        let lock = registry.build_lock(context).await;
        let _guard = lock.lock().await;

        // Another task may have finished building while we waited.
        if !force_rebuild {
            if let Some(client) = registry.get_cached(context).await {
                return Ok(client);
            }
        }

        Self::ensure_exec_plugin_path_env();

        let (kubeconfig, _token) =
            K8sContexts::get_context_secrets(context)
                .await
                .map_err(|e| AppError::Kubeconfig {
                    context: context.to_string(),
                    message: redact(&e),
                })?;

        let sanitized = Self::sanitize_yaml(&kubeconfig);
        let client = Self::build_client(context, &sanitized).await?;

        registry.store(context.to_string(), client.clone()).await;
        tracing::debug!(context, "built and cached kubernetes client");

        Ok(client)
    }

    /// Strip control characters that would otherwise break YAML parsing.
    ///
    /// This also papers over a historical bug where `Crypto::encrypt` appended 16
    /// NUL bytes to the plaintext. That bug is fixed, but old ciphertexts on disk
    /// still decrypt with the trailing NULs, so this filter must stay.
    fn sanitize_yaml(s: &str) -> String {
        s.chars()
            .filter(|&c| matches!(c, '\n' | '\r' | '\t') || !c.is_control())
            .collect()
    }

    async fn build_client(context: &str, sanitized: &str) -> AppResult<Client> {
        let mut errs: Vec<String> = Vec::new();

        // Preferred path: parse the stored YAML directly, no filesystem involved.
        match Self::client_from_yaml(context, sanitized).await {
            Ok(client) => return Ok(client),
            Err(msg) => errs.push(msg),
        }

        // Fallback: some kubeconfigs only resolve correctly when read through
        // `Kubeconfig::read_from` (which performs path expansion relative to the
        // file). Write a private, mode-0600 temp file, use it, delete it.
        //
        // The previous implementation wrote a plaintext kubeconfig to the shared
        // system temp dir, mutated the process-global KUBECONFIG env var, and
        // never removed the file. That was both a credential leak and a race
        // between concurrent commands.
        match Self::client_from_temp_file(context, sanitized).await {
            Ok(client) => Ok(client),
            Err(msg) => {
                errs.push(msg);
                Err(AppError::Kubeconfig {
                    context: context.to_string(),
                    message: errs.join("; "),
                })
            }
        }
    }

    async fn client_from_yaml(context: &str, sanitized: &str) -> Result<Client, String> {
        // serde-saphyr replaces the archived serde_yaml, and is the same parser kube
        // itself now uses for kubeconfigs, so this path and `Kubeconfig::read_from`
        // below can no longer disagree about what a given file means.
        let kcfg: Kubeconfig =
            serde_saphyr::from_str(sanitized).map_err(|e| redact(&format!("parse: {e}")))?;
        Self::client_from_kubeconfig(context, kcfg).await
    }

    async fn client_from_kubeconfig(context: &str, kcfg: Kubeconfig) -> Result<Client, String> {
        let opts = KubeConfigOptions {
            context: Some(context.to_string()),
            ..Default::default()
        };
        // Two kube 4 defaults are load-bearing here and are deliberately left alone:
        //
        // * `Config::read_timeout` now defaults to `None` instead of a fixed 295s. That is
        //   what we want: the old default was a hard ceiling on exec, attach and
        //   port-forward sessions, and watch liveness no longer depends on it — kube-runtime
        //   applies its own idle timeout to the watch stream.
        // * `Config::default_retry` is new and defaults to `true`, so non-watch requests
        //   transparently retry 429/503/504. Kept on: every one of these calls is driven by
        //   a user action in the UI, and a silent retry is strictly better than surfacing a
        //   throttle as a failed list. It does mean `AppError::is_retryable` now mostly sees
        //   failures that kube already gave up on.
        //
        // If either needs overriding, mutate `cfg` here — `Config` is `#[non_exhaustive]`,
        // so it can only be adjusted field-by-field after construction, never built literally.
        let cfg = Config::from_custom_kubeconfig(kcfg, &opts)
            .await
            .map_err(|e| redact(&format!("config: {e}")))?;
        Client::try_from(cfg).map_err(|e| redact(&format!("client: {e}")))
    }

    async fn client_from_temp_file(context: &str, sanitized: &str) -> Result<Client, String> {
        let path = Self::private_temp_path(context);
        if let Some(parent) = path.parent() {
            tokio::fs::create_dir_all(parent)
                .await
                .map_err(|e| e.to_string())?;
            Self::harden_permissions(parent, 0o700);
        }

        tokio::fs::write(&path, sanitized)
            .await
            .map_err(|e| e.to_string())?;
        Self::harden_permissions(&path, 0o600);

        let parsed = Kubeconfig::read_from(&path).map_err(|e| redact(&format!("read: {e}")));

        // Always remove the plaintext copy, on success and failure alike.
        let _ = tokio::fs::remove_file(&path).await;

        Self::client_from_kubeconfig(context, parsed?).await
    }

    /// Temp kubeconfigs live under the app data dir, never the world-readable
    /// system temp dir, and are named per-context so concurrent builds for
    /// different contexts cannot clobber each other.
    fn private_temp_path(context: &str) -> PathBuf {
        let safe: String = context
            .chars()
            .map(|c| {
                if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
                    c
                } else {
                    '_'
                }
            })
            .collect();
        crate::constants::app::APP_TMP_DIR.join(format!("ctx_{safe}.yaml"))
    }

    #[cfg(unix)]
    fn harden_permissions(path: &Path, mode: u32) {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(path, std::fs::Permissions::from_mode(mode));
    }

    #[cfg(not(unix))]
    fn harden_permissions(_path: &Path, _mode: u32) {
        // Windows ACL inheritance from the per-user AppData directory is relied on here.
    }

    /// Check connectivity to a context by querying the apiserver version.
    pub async fn check_context_connection(context: &str) -> AppResult<()> {
        Self::probe(context).await.map(|_| ())
    }

    /// Retrieve the apiserver git version string for the given context.
    pub async fn get_context_version(context: &str) -> AppResult<String> {
        Self::probe(context).await
    }

    async fn probe(context: &str) -> AppResult<String> {
        let ctx = context.to_string();
        let fut = async move {
            let client = Self::for_context_fresh(&ctx).await?;
            client
                .apiserver_version()
                .await
                .map(|v| v.git_version)
                .map_err(|e| AppError::from_kube(&e, "apiserver version"))
        };

        match tokio::time::timeout(PROBE_TIMEOUT, fut).await {
            Ok(result) => result,
            Err(_) => Err(AppError::Timeout {
                seconds: PROBE_TIMEOUT.as_secs(),
            }),
        }
    }
}
