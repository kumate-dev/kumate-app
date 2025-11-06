use std::collections::HashMap;
use tokio::sync::{mpsc::Sender, Mutex};
use tokio::task::JoinHandle;
use serde::Serialize;

#[derive(Default)]
pub struct PortForwardManager {
    sessions: Mutex<HashMap<String, PortForwardSession>>,
}

pub struct PortForwardSession {
    pub kill_tx: Sender<()>,
    pub handle: JoinHandle<()>,
    pub context: String,
    pub namespace: String,
    pub resource_kind: String,
    pub resource_name: String,
    pub local_port: u16,
    pub remote_port: u16,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PortForwardItem {
    pub session_id: String,
    pub context: String,
    pub namespace: String,
    pub resource_kind: String,
    pub resource_name: String,
    pub local_port: u16,
    pub remote_port: u16,
    pub protocol: String,
    pub status: String,
}

impl PortForwardManager {
    pub async fn insert(&self, id: String, session: PortForwardSession) {
        self.sessions.lock().await.insert(id, session);
    }

    pub async fn stop(&self, id: &str) -> Result<(), String> {
        if let Some(sess) = self.sessions.lock().await.remove(id) {
            // Notify task to terminate and abort in case it's blocked.
            let _ = sess.kill_tx.send(()).await;
            sess.handle.abort();
        }
        Ok(())
    }

    pub async fn list(&self) -> Vec<PortForwardItem> {
        let sessions = self.sessions.lock().await;
        sessions
            .iter()
            .map(|(id, s)| PortForwardItem {
                session_id: id.clone(),
                context: s.context.clone(),
                namespace: s.namespace.clone(),
                resource_kind: s.resource_kind.clone(),
                resource_name: s.resource_name.clone(),
                local_port: s.local_port,
                remote_port: s.remote_port,
                protocol: "TCP".to_string(),
                status: "Running".to_string(),
            })
            .collect()
    }
}
