use std::collections::HashMap;
use std::future::Future;
use tauri::AppHandle;
use tokio::sync::Mutex;
use tokio::task::JoinHandle;

#[derive(Default)]
pub struct WatchManager {
    handles: Mutex<HashMap<String, JoinHandle<()>>>,
}

impl WatchManager {
    pub async fn watch<Fut>(
        &self,
        app_handle: AppHandle,
        name: String,
        watch_fn: impl Fn(AppHandle, String) -> Fut + Send + 'static,
    ) -> Result<(), String>
    where
        Fut: Future<Output = Result<(), String>> + Send + 'static,
    {
        {
            let mut handles = self.handles.lock().await;
            if handles.contains_key(&name) {
                return Ok(());
            }

            let max_watchers: usize = crate::constants::watch::MAX_WATCHERS;
            if handles.len() >= max_watchers {
                let current_cluster_prefix = cluster_prefix(&name);
                if let Some(prefix) = current_cluster_prefix.as_deref() {
                    // First try removing watchers not matching the current cluster prefix
                    let keys: Vec<String> = handles.keys().cloned().collect();
                    for k in keys {
                        if !k.starts_with(prefix) {
                            if let Some(handle) = handles.remove(&k) {
                                handle.abort();
                            }
                            if handles.len() < max_watchers {
                                break;
                            }
                        }
                    }
                }
                if handles.len() >= max_watchers {
                    let keys: Vec<String> = handles.keys().cloned().collect();
                    for k in keys {
                        if k != name {
                            if let Some(handle) = handles.remove(&k) {
                                handle.abort();
                            }
                            if handles.len() < max_watchers {
                                break;
                            }
                        }
                    }
                }
            }
        }

        let name_clone: String = name.clone();
        let app_handle_clone: AppHandle = app_handle.clone();

        let join_handle: JoinHandle<()> = tokio::spawn(async move {
            let _ = watch_fn(app_handle_clone, name_clone).await;
        });

        self.handles.lock().await.insert(name, join_handle);
        Ok(())
    }

    pub async fn unwatch(&self, name: &str) -> Result<(), String> {
        if let Some(handle) = self.handles.lock().await.remove(name) {
            handle.abort();
        }
        Ok(())
    }

    pub async fn unwatch_prefix(&self, prefix: &str) -> Result<u32, String> {
        let mut removed: u32 = 0;
        let mut handles = self.handles.lock().await;
        let keys_to_remove: Vec<String> =
            handles.keys().filter(|k| k.starts_with(prefix)).cloned().collect();
        for k in keys_to_remove {
            if let Some(h) = handles.remove(&k) {
                h.abort();
                removed += 1;
            }
        }
        Ok(removed)
    }

    pub async fn count(&self) -> usize {
        self.handles.lock().await.len()
    }
}

// Helper: derive the cluster prefix (e.g., "k8s://my-cluster/") from an event name
fn cluster_prefix(event_name: &str) -> Option<String> {
    if let Some(stripped) = event_name.strip_prefix("k8s://") {
        if let Some(pos) = stripped.find('/') {
            let cluster = &stripped[..pos];
            return Some(format!("k8s://{}/", cluster));
        }
    }
    None
}
