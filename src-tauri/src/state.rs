//! Application state.
//!
//! # Layout
//!
//! State is split into two groups, deliberately:
//!
//! * **Tauri-managed** (`AppState`, `WatchManager`, `ExecManager`,
//!   `PortForwardManager`) — reached through `tauri::State<'_, T>` in commands.
//! * **Process-global** ([`ConnectionsManager`], [`ClientRegistry`],
//!   [`ResourceStore`]) — reached through `T::global()`.
//!
//! The globals are not an accident or a shortcut. They are read from static
//! functions deep in the Kubernetes layer (`K8sClient::for_context`, the watch
//! driver) which are called from ~200 sites and have no access to an `AppHandle`.
//! Threading `State` down to all of them would mean changing every signature in
//! the resource layer for no behavioural gain.
//!
//! `AppState` exposes accessors for the globals so that there is one discoverable
//! entry point to all backend state, and so that a future refactor can move them
//! behind managed state without touching call sites again.

use std::path::PathBuf;

use anyhow::Result;

use crate::databases::{k8s_contexts::K8sContextsRepo, Database};
use crate::manager::k8s::client::ClientRegistry;
use crate::manager::k8s::store::ResourceStore;
use crate::utils::connections::ConnectionsManager;

#[derive(Clone)]
pub struct AppState {
    pub k8s_contexts: K8sContextsRepo,
}

impl AppState {
    pub async fn init(data_dir: PathBuf) -> Result<Self> {
        let db: Database = Database::init(data_dir).await?;
        let k8s_contexts: K8sContextsRepo = K8sContextsRepo::new(&db.db)?;
        Ok(Self { k8s_contexts })
    }

    /// Connect/disconnect gating, consulted before every apiserver request.
    pub fn connections(&self) -> &'static ConnectionsManager {
        ConnectionsManager::global()
    }

    /// Cache of built `kube::Client`s, one per context.
    pub fn clients(&self) -> &'static ClientRegistry {
        ClientRegistry::global()
    }

    /// In-memory cache of watched Kubernetes objects.
    pub fn resources(&self) -> &'static ResourceStore {
        ResourceStore::global()
    }
}
