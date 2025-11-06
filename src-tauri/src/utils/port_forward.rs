use std::collections::HashMap;
use tokio::sync::{mpsc::Sender, Mutex};
use tokio::task::JoinHandle;

#[derive(Default)]
pub struct PortForwardManager {
    sessions: Mutex<HashMap<String, PortForwardSession>>,
}

pub struct PortForwardSession {
    pub kill_tx: Sender<()>,
    pub handle: JoinHandle<()>,
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
}
