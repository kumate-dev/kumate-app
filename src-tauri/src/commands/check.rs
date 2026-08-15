use crate::manager::k8s::client::K8sClient;

// These two commands still speak the legacy `Result<_, String>` wire shape. The
// managers behind them now return `AppResult`, and a tail expression does *not*
// get the `?`-operator's implicit `From` conversion — so the bridge has to be
// explicit here. `From<AppError> for String` in `crate::error` is exactly that
// bridge; remove these `map_err`s when the commands move to `AppResult`.

#[tauri::command]
pub async fn check_context_connection(name: String) -> Result<(), String> {
    K8sClient::check_context_connection(&name)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_context_version(name: String) -> Result<String, String> {
    K8sClient::get_context_version(&name)
        .await
        .map_err(|e| e.to_string())
}
