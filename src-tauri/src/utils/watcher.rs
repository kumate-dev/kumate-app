//! Lifecycle management for active Kubernetes watches.
//!
//! One entry per `k8s://<context>/<resource>[/ns/<a:b>]` event name. Each entry
//! owns a single task; that task drives every namespace stream for the watch
//! concurrently (see `manager::k8s::watch_loop`), so there are no untracked child
//! tasks to leak.
//!
//! ## The bug this rewrite fixes
//!
//! The previous implementation kept a `JoinHandle` in a map and short-circuited
//! `watch()` whenever the key was present. Because the old raw-`Api::watch` loop
//! terminated on any stream end (which the apiserver triggers every few minutes),
//! the task would finish while its handle stayed in the map. From then on every
//! `watch_*` call for that resource returned `Ok(())` without starting anything,
//! and the UI stayed stale until the user switched clusters. Entries are now
//! removed by the task itself as it exits, so a dead watch is always restartable.

use std::collections::HashMap;
use std::future::Future;
use std::sync::Arc;
use std::time::Instant;

use tauri::AppHandle;
use tokio::sync::RwLock;
use tokio::task::JoinHandle;
use tokio_util::sync::CancellationToken;

use crate::error::{AppError, AppResult};
use crate::manager::k8s::store::ResourceStore;

struct WatchEntry {
    cancel: CancellationToken,
    handle: JoinHandle<()>,
    started_at: Instant,
}

#[derive(Default)]
pub struct WatchManager {
    /// `Arc` so a spawned task can deregister itself on completion.
    entries: Arc<RwLock<HashMap<String, WatchEntry>>>,
}

impl WatchManager {
    /// Start a watch under `event_name`, unless one is already running.
    ///
    /// `watch_fn` receives a [`CancellationToken`] and must poll it; everything it
    /// spawns should share the token so `unwatch` is complete.
    pub async fn watch<Fut>(
        &self,
        app_handle: AppHandle,
        event_name: String,
        watch_fn: impl FnOnce(AppHandle, CancellationToken) -> Fut + Send + 'static,
    ) -> AppResult<()>
    where
        Fut: Future<Output = AppResult<()>> + Send + 'static,
    {
        {
            let entries = self.entries.read().await;
            if entries.contains_key(&event_name) {
                return Ok(());
            }
        }

        self.evict_if_needed(&event_name).await;

        let cancel = CancellationToken::new();
        let entries = Arc::clone(&self.entries);
        let task_cancel = cancel.clone();
        let key = event_name.clone();

        // The write guard is taken *before* the spawn and released only after the
        // entry is in the map. On a multi-thread runtime the task starts on another
        // worker immediately, and a `watch_fn` that fails fast — a disconnected
        // cluster or a bad kubeconfig returns before the first apiserver round trip —
        // would otherwise reach its own `entries.write()` first. Its `remove` would
        // then be a no-op and the `insert` below would publish an entry for a task
        // that has already exited: exactly the "dead watch wedged in the map" bug
        // this rewrite exists to fix. Holding the guard across `tokio::spawn` (which
        // is not an await point, so nothing is blocked and the future stays `Send`)
        // makes the registration strictly happen-before the deregistration.
        let mut guard = self.entries.write().await;

        let handle = tokio::spawn(async move {
            if let Err(err) = watch_fn(app_handle, task_cancel).await {
                tracing::warn!(event = %key, error = %err, "watch task failed");
            }
            // Deregister so a later `watch()` for the same resource can restart it.
            entries.write().await.remove(&key);
            ResourceStore::global().drop_event(&key).await;
        });

        guard.insert(
            event_name,
            WatchEntry {
                cancel,
                handle,
                started_at: Instant::now(),
            },
        );
        drop(guard);

        Ok(())
    }

    /// Enforce [`MAX_WATCHERS`](crate::constants::watch::MAX_WATCHERS).
    ///
    /// Prefers evicting watches belonging to *other* clusters, then the oldest
    /// remaining ones. The previous version iterated a `HashMap` in arbitrary
    /// order, so which watch died was effectively random.
    async fn evict_if_needed(&self, event_name: &str) {
        let max = crate::constants::watch::MAX_WATCHERS;

        let victims: Vec<String> = {
            let entries = self.entries.read().await;
            if entries.len() < max {
                return;
            }

            let current_prefix = cluster_prefix(event_name);
            let mut candidates: Vec<(&String, bool, Instant)> = entries
                .iter()
                .filter(|(k, _)| k.as_str() != event_name)
                .map(|(k, e)| {
                    let same_cluster = current_prefix
                        .as_deref()
                        .map(|p| k.starts_with(p))
                        .unwrap_or(false);
                    (k, same_cluster, e.started_at)
                })
                .collect();

            // Other clusters first, then oldest first.
            candidates.sort_by(|a, b| a.1.cmp(&b.1).then(a.2.cmp(&b.2)));

            let overflow = entries.len() + 1 - max;
            candidates
                .into_iter()
                .take(overflow)
                .map(|(k, _, _)| k.clone())
                .collect()
        };

        for victim in victims {
            tracing::debug!(event = %victim, "evicting watch to stay under the limit");
            let _ = self.unwatch(&victim).await;
        }
    }

    pub async fn unwatch(&self, event_name: &str) -> AppResult<()> {
        let entry = self.entries.write().await.remove(event_name);
        if let Some(entry) = entry {
            Self::stop(entry).await;
            ResourceStore::global().drop_event(event_name).await;
        }
        Ok(())
    }

    /// Stop every watch whose event name starts with `prefix`.
    /// Used to tear down a whole cluster: `k8s://my-cluster/`.
    pub async fn unwatch_prefix(&self, prefix: &str) -> AppResult<u32> {
        let victims: Vec<(String, WatchEntry)> = {
            let mut entries = self.entries.write().await;
            let keys: Vec<String> = entries
                .keys()
                .filter(|k| k.starts_with(prefix))
                .cloned()
                .collect();
            keys.into_iter()
                .filter_map(|k| entries.remove(&k).map(|e| (k, e)))
                .collect()
        };

        let removed = victims.len() as u32;
        for (_, entry) in victims {
            Self::stop(entry).await;
        }
        ResourceStore::global().drop_matching(prefix).await;

        Ok(removed)
    }

    /// Cancel cooperatively, then abort as a backstop.
    ///
    /// A task blocked in client construction (DNS, an auth plugin) will not observe
    /// the token, so we do not want to `await` the handle indefinitely.
    async fn stop(entry: WatchEntry) {
        entry.cancel.cancel();
        entry.handle.abort();
    }

    pub async fn count(&self) -> usize {
        self.entries.read().await.len()
    }

    pub async fn is_watching(&self, event_name: &str) -> bool {
        self.entries.read().await.contains_key(event_name)
    }

    /// Active event names, for diagnostics.
    pub async fn active(&self) -> Vec<String> {
        self.entries.read().await.keys().cloned().collect()
    }
}

/// Separator between namespaces in a multi-namespace event name.
///
/// A Kubernetes namespace is a DNS-1123 label — lowercase alphanumerics and `-` only —
/// so `:` can never occur inside one and is unambiguous as a joiner. It is also one of
/// the few characters Tauri permits in an event name, which `,` (the original choice)
/// is not.
const NS_SEPARATOR: char = ':';

/// Is this character legal inside an event-name *segment*?
///
/// Tauri permits `[A-Za-z0-9]`, `-`, `/`, `:` and `_` in an event name overall. Within a
/// segment we additionally exclude:
///
/// * `/`, because it is the segment delimiter — an EKS context is an ARN
///   (`arn:aws:eks:…:cluster/prod`) and its slash would forge a path segment and break
///   [`cluster_prefix`].
/// * `_`, because it is the escape introducer below and must itself be escapable.
fn is_segment_safe(c: char) -> bool {
    c.is_ascii_alphanumeric() || c == '-' || c == ':'
}

/// Escape a segment into Tauri's permitted event-name character set.
///
/// ## Why this is needed
///
/// Tauri rejects `emit()` outright when the event name contains anything outside
/// `[A-Za-z0-9]`, `-`, `/`, `:`, `_`. Context names routinely violate that: kubeadm's
/// default is `kubernetes-admin@kubernetes`, GKE uses `gke_project_zone_cluster`, and
/// plenty of hand-written kubeconfigs use dots. Before this, every watch event for such
/// a cluster was silently dropped at the emit boundary — the watch ran, the cache
/// filled, and the UI received nothing.
///
/// The mapping is injective (`_` + two hex digits, with a literal `_` escaped as `_5F`),
/// so two different contexts can never collapse onto the same channel and cross-wire
/// their watches. That matters more than readability here: a collision would show one
/// cluster's objects under another.
pub fn escape_segment(segment: &str) -> String {
    let mut out = String::with_capacity(segment.len());
    for c in segment.chars() {
        if is_segment_safe(c) {
            out.push(c);
        } else {
            // Non-ASCII is encoded per UTF-8 byte so the result stays ASCII.
            let mut buf = [0u8; 4];
            for byte in c.encode_utf8(&mut buf).as_bytes() {
                out.push('_');
                out.push_str(&format!("{byte:02X}"));
            }
        }
    }
    out
}

/// Inverse of [`escape_segment`], for displaying a channel name to a human.
pub fn unescape_segment(segment: &str) -> String {
    let bytes = segment.as_bytes();
    let mut out: Vec<u8> = Vec::with_capacity(bytes.len());
    let mut i = 0;

    while i < bytes.len() {
        if bytes[i] == b'_' && i + 2 < bytes.len() {
            let hex = &segment[i + 1..i + 3];
            if let Ok(byte) = u8::from_str_radix(hex, 16) {
                out.push(byte);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }

    String::from_utf8_lossy(&out).into_owned()
}

/// The event-name prefix covering every watch for a cluster.
///
/// The single source of truth for this string. `set_context_connection` and the
/// cluster-teardown command both go through it, so the escaping can never drift between
/// the name a watch is registered under and the prefix used to tear it down.
pub fn cluster_event_prefix(context: &str) -> String {
    format!("k8s://{}/", escape_segment(context))
}

/// Derive the cluster prefix (`k8s://my-cluster/`) from an event name.
pub fn cluster_prefix(event_name: &str) -> Option<String> {
    let stripped = event_name.strip_prefix("k8s://")?;
    let pos = stripped.find('/')?;
    Some(format!("k8s://{}/", &stripped[..pos]))
}

/// Build the canonical event name for a watch.
///
/// Namespaces are sorted so that the same selection always produces the same key
/// regardless of the order the UI sends them in.
pub fn build_event_name(context: &str, resource: &str, namespaces: Option<&[String]>) -> String {
    let context = escape_segment(context);

    match namespaces {
        Some(ns) if !ns.is_empty() => {
            let mut sorted: Vec<String> = ns.iter().map(|n| escape_segment(n)).collect();
            sorted.sort_unstable();
            let joined = sorted.join(&NS_SEPARATOR.to_string());
            format!("k8s://{context}/{resource}/ns/{joined}")
        }
        _ => format!("k8s://{context}/{resource}"),
    }
}

/// Guard against a resource segment that would corrupt the event-name scheme.
///
/// Slashes ARE permitted: custom resources legitimately use a multi-segment key
/// (`custom_resources/<group>/<version>/<plural>`), and [`cluster_prefix`] only
/// ever looks at the first path segment, so deeper segments are harmless.
///
/// Unlike the context and namespace segments this one is not escaped, because it is
/// built from our own vocabulary rather than from cluster data — so instead we assert
/// that it is already event-name safe. A descriptor that introduces an illegal
/// character should fail loudly here, not silently stop delivering events.
pub fn validate_resource_name(resource: &str) -> AppResult<()> {
    if resource.is_empty() {
        return Err(AppError::invalid("resource segment must not be empty"));
    }

    let illegal = |c: char| !(is_segment_safe(c) || c == '/' || c == '_');
    if let Some(bad) = resource.chars().find(|c| illegal(*c)) {
        return Err(AppError::invalid(format!(
            "resource segment {resource:?} contains {bad:?}, which Tauri rejects in an event name"
        )));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Everything Tauri permits in an event name.
    fn tauri_safe(name: &str) -> bool {
        name.chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '/' | ':' | '_'))
    }

    #[test]
    fn escapes_context_names_tauri_rejects() {
        // kubeadm's default, and the shape that made every watch event silently vanish.
        assert!(tauri_safe(&escape_segment("kubernetes-admin@kubernetes")));
        assert!(tauri_safe(&escape_segment(
            "gke_my-project_us-central1_prod"
        )));
        assert!(tauri_safe(&escape_segment(
            "arn:aws:eks:us-east-1:1234:cluster/prod"
        )));
        assert!(tauri_safe(&escape_segment("cluster.local")));
    }

    #[test]
    fn escaping_round_trips() {
        for original in [
            "kubernetes-admin@kubernetes",
            "gke_my-project_us-central1_prod",
            "arn:aws:eks:us-east-1:1234:cluster/prod",
            "plain-name",
            "unicode-ns-café",
        ] {
            assert_eq!(unescape_segment(&escape_segment(original)), original);
        }
    }

    #[test]
    fn escaping_is_injective() {
        // The collision that would cross-wire two clusters onto one channel if `_` were
        // left unescaped: both of these must survive as distinct names.
        assert_ne!(escape_segment("a_b"), escape_segment("a.b"));
        assert_ne!(escape_segment("a-b"), escape_segment("a_b"));
    }

    #[test]
    fn multi_namespace_event_names_are_emittable() {
        // The reported bug: `,` is not in Tauri's permitted set, so every event for a
        // multi-namespace watch was dropped at the emit boundary.
        let name = build_event_name(
            "orbstack",
            "pods",
            Some(&["default".to_string(), "example-namespaces".to_string()]),
        );
        assert!(tauri_safe(&name), "not emittable: {name}");
        assert_eq!(name, "k8s://orbstack/pods/ns/default:example-namespaces");
    }

    #[test]
    fn namespace_order_does_not_change_the_name() {
        let a = build_event_name("c", "pods", Some(&["b".into(), "a".into()]));
        let b = build_event_name("c", "pods", Some(&["a".into(), "b".into()]));
        assert_eq!(a, b);
    }

    #[test]
    fn cluster_prefix_matches_what_build_event_name_produces() {
        // If these two ever disagree, disconnecting a cluster silently stops nothing.
        let context = "kubernetes-admin@kubernetes";
        let event = build_event_name(context, "pods", None);
        assert!(event.starts_with(&cluster_event_prefix(context)));
        assert_eq!(
            cluster_prefix(&event).as_deref(),
            Some(cluster_event_prefix(context).as_str())
        );
    }

    #[test]
    fn resource_segment_must_be_emittable() {
        assert!(validate_resource_name("pods").is_ok());
        assert!(validate_resource_name("custom_resources/apps/v1/widgets").is_ok());
        assert!(validate_resource_name("").is_err());
        assert!(validate_resource_name("bad,name").is_err());
    }
}
