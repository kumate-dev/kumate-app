use serde::Serialize;
use std::collections::HashMap;
use tokio::sync::{mpsc::Sender, Mutex};
use tokio::task::JoinHandle;
use tokio_util::sync::CancellationToken;

#[derive(Default)]
pub struct PortForwardManager {
    sessions: Mutex<HashMap<String, PortForwardSession>>,
}

pub struct PortForwardSession {
    pub kill_tx: Option<Sender<()>>,
    pub handle: Option<JoinHandle<()>>,
    pub cancel_token: Option<CancellationToken>,
    pub context: String,
    pub namespace: String,
    pub resource_kind: String,
    pub resource_name: String,
    pub local_port: u16,
    pub remote_port: u16,
    pub status: String,
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
        let mut sessions = self.sessions.lock().await;
        if let Some(sess) = sessions.get_mut(id) {
            if let Some(tx) = &sess.kill_tx {
                let _ = tx.send(()).await;
            }
            if let Some(handle) = &sess.handle {
                handle.abort();
            }
            if let Some(token) = &sess.cancel_token {
                token.cancel();
            }
            sess.kill_tx = None;
            sess.handle = None;
            sess.cancel_token = None;
            sess.status = "Stopped".to_string();
        }
        Ok(())
    }

    pub async fn delete(&self, id: &str) -> Result<(), String> {
        {
            let mut sessions = self.sessions.lock().await;
            if let Some(sess) = sessions.get_mut(id) {
                if let Some(tx) = &sess.kill_tx {
                    let _ = tx.send(()).await;
                }
                if let Some(handle) = &sess.handle {
                    handle.abort();
                }
                if let Some(token) = &sess.cancel_token {
                    token.cancel();
                }
            }
        }

        let mut sessions = self.sessions.lock().await;
        sessions.remove(id);
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
                status: s.status.clone(),
            })
            .collect()
    }

    pub async fn get_config(&self, id: &str) -> Option<(String, String, String, String, u16, u16)> {
        let sessions = self.sessions.lock().await;
        sessions.get(id).map(|s| {
            (
                s.context.clone(),
                s.namespace.clone(),
                s.resource_kind.clone(),
                s.resource_name.clone(),
                s.local_port,
                s.remote_port,
            )
        })
    }
}
