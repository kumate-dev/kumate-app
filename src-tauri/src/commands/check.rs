use crate::manager::k8s::client::K8sClient;

#[tauri::command]
pub async fn check_context_connection(name: String) -> Result<(), String> {
    K8sClient::check_context_connection(&name).await
}

#[tauri::command]
pub async fn get_context_version(name: String) -> Result<String, String> {
    K8sClient::get_context_version(&name).await
}
