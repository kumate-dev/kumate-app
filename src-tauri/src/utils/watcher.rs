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
}
