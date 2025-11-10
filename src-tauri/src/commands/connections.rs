use crate::utils::connections::ConnectionsManager;
use crate::utils::watcher::WatchManager;

#[tauri::command]
pub async fn set_context_connection(
    name: String,
    connected: bool,
    cm: tauri::State<'_, ConnectionsManager>,
    wm: tauri::State<'_, WatchManager>,
) -> Result<(), String> {
    // Update both managed state and the global store so all modules (including those
    // without direct AppHandle access) see consistent connection status.
    cm.set(name.clone(), connected).await;
    ConnectionsManager::global().set(name.clone(), connected).await;
    if !connected {
        // Abort any watchers tied to this context name
        let _ = wm.unwatch(&name).await;
    }
    Ok(())
}

#[tauri::command]
pub async fn get_context_connections(
    cm: tauri::State<'_, ConnectionsManager>,
) -> Result<Vec<(String, bool)>, String> {
    let _ = cm; // prefer returning from the global store to keep consistency
    Ok(ConnectionsManager::global().list().await)
}

#[tauri::command]
pub async fn get_context_connection(
    name: String,
    cm: tauri::State<'_, ConnectionsManager>,
) -> Result<bool, String> {
    let _ = cm; // prefer reading from the global store
    Ok(ConnectionsManager::global().is_connected(&name).await)
}
