use std::collections::HashMap;
use tokio::sync::{mpsc::Sender, Mutex};
use tokio::task::JoinHandle;

#[derive(Default)]
pub struct ExecManager {
    sessions: Mutex<HashMap<String, ExecSession>>,
}

pub struct ExecSession {
    pub stdin_tx: Sender<Vec<u8>>,
    pub handle: JoinHandle<()>,
}

impl ExecManager {
    pub async fn insert(&self, id: String, session: ExecSession) {
        self.sessions.lock().await.insert(id, session);
    }

    pub async fn send(&self, id: &str, data: Vec<u8>) -> Result<(), String> {
        if let Some(sess) = self.sessions.lock().await.get(id) {
            sess.stdin_tx.send(data).await.map_err(|e| format!("failed to send input: {}", e))
        } else {
            Err(format!("exec session '{}' not found", id))
        }
    }

    pub async fn stop(&self, id: &str) -> Result<(), String> {
        if let Some(sess) = self.sessions.lock().await.remove(id) {
            sess.handle.abort();
        }
        Ok(())
    }
}
