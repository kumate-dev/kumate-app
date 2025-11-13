use crate::{
    manager::k8s::contexts::K8sContexts, state::AppState, types::k8s_contexts::K8sContext,
};
use serde_json::Value;

#[tauri::command]
pub async fn import_kube_contexts(state: tauri::State<'_, AppState>) -> Result<usize, String> {
    K8sContexts::import_from_home(&state).await
}

#[tauri::command]
pub async fn list_contexts(state: tauri::State<'_, AppState>) -> Result<Vec<K8sContext>, String> {
    K8sContexts::list_contexts(&state).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_context_metadata(
    state: tauri::State<'_, AppState>,
    args: Value,
) -> Result<K8sContext, String> {
    // Manually parse to be resilient to camelCase/snake_case mismatches
    let name = args
        .get("name")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "missing required 'name'".to_string())?
        .to_string();
    let display_name = args
        .get("display_name")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .or_else(|| args.get("displayName").and_then(|v| v.as_str()).map(|s| s.to_string()));
    let avatar_base64 = args
        .get("avatar_base64")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .or_else(|| args.get("avatarBase64").and_then(|v| v.as_str()).map(|s| s.to_string()));

    K8sContexts::update_context_metadata(&state, name, display_name, avatar_base64)
}
