use crate::utils::watcher::WatchManager;


#[tauri::command]
pub async fn unwatch(
    state: tauri::State<'_, WatchManager>,
    name: String,
) -> Result<(), String> {
    state.unwatch(&name).await
}
