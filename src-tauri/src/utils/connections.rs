//! Per-context connect/disconnect gating.
//!
//! A "disconnected" cluster must generate no apiserver traffic at all, so this is
//! consulted by [`K8sClient::for_context`](crate::manager::k8s::client::K8sClient::for_context)
//! on the way to every request.
//!
//! # Why this is a global
//!
//! It used to exist *twice*: once as Tauri managed state and once as a `OnceLock`
//! global. `set_context_connection` wrote both, but every reader used the global —
//! including the client builder — so the managed copy was dead weight that could
//! silently drift out of sync. There is now exactly one instance.
//!
//! It stays a global rather than becoming managed state because it is read from
//! static functions deep in the Kubernetes layer that have no `AppHandle`. It is
//! also exposed through [`AppState`](crate::state::AppState) for discoverability.
//!
//! Reads vastly outnumber writes (one read per API call, one write per user click),
//! so this is an `RwLock`, not a `Mutex`. The previous `Mutex` serialized every
//! Kubernetes request in the process behind a single lock acquisition.

use std::collections::HashMap;
use std::sync::OnceLock;
use tokio::sync::RwLock;

#[derive(Default)]
pub struct ConnectionsManager {
    /// `true` = connected. Absent means connected: contexts are usable as soon as
    /// they are imported, without needing an explicit connect.
    statuses: RwLock<HashMap<String, bool>>,
}

impl ConnectionsManager {
    pub fn global() -> &'static ConnectionsManager {
        static GLOBAL_CONNECTIONS: OnceLock<ConnectionsManager> = OnceLock::new();
        GLOBAL_CONNECTIONS.get_or_init(ConnectionsManager::default)
    }

    pub async fn set(&self, name: String, connected: bool) {
        self.statuses.write().await.insert(name, connected);
    }

    pub async fn is_connected(&self, name: &str) -> bool {
        self.statuses
            .read()
            .await
            .get(name)
            .copied()
            .unwrap_or(true)
    }

    pub async fn list(&self) -> Vec<(String, bool)> {
        self.statuses
            .read()
            .await
            .iter()
            .map(|(k, v)| (k.clone(), *v))
            .collect()
    }

    // pub async fn forget(&self, name: &str) {
    //     self.statuses.write().await.remove(name);
    // }
}
