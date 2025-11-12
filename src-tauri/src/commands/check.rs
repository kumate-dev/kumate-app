use tokio::time::{timeout, Duration};

#[tauri::command]
pub async fn check_context_connection(name: String) -> Result<(), String> {
    match timeout(
        Duration::from_secs(10),
        crate::commands::namespaces::list_namespaces(name),
    )
    .await
    {
        Ok(Ok(_)) => Ok(()),
        Ok(Err(e)) => Err(e),
        Err(_) => Err("Connection check timed out".to_string()),
    }
}