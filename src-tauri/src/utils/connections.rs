use std::collections::HashMap;
use std::sync::OnceLock;
use tokio::sync::Mutex;

#[derive(Default)]
pub struct ConnectionsManager {
    statuses: Mutex<HashMap<String, bool>>, // true = connected, false = disconnected
}

impl ConnectionsManager {
    pub async fn set(&self, name: String, connected: bool) {
        self.statuses.lock().await.insert(name, connected);
    }

    pub async fn is_connected(&self, name: &str) -> bool {
        match self.statuses.lock().await.get(name) {
            Some(v) => *v,
            None => true, // default connected if not set
        }
    }

    pub async fn list(&self) -> Vec<(String, bool)> {
        self.statuses.lock().await.iter().map(|(k, v)| (k.clone(), *v)).collect()
    }

    // Global accessor to allow modules without AppHandle access to read connection state.
    pub fn global() -> &'static ConnectionsManager {
        static GLOBAL_CONNECTIONS: OnceLock<ConnectionsManager> = OnceLock::new();
        GLOBAL_CONNECTIONS.get_or_init(|| ConnectionsManager::default())
    }
}
