use crate::{k8s::contexts::K8sContexts, state::AppState, types::k8s_contexts::K8sContext};

#[tauri::command]
pub async fn import_kube_contexts(state: tauri::State<'_, AppState>) -> Result<usize, String> {
    K8sContexts::import_from_home(&state).await
}

#[tauri::command]
pub async fn list_contexts(state: tauri::State<'_, AppState>) -> Result<Vec<K8sContext>, String> {
    K8sContexts::list_contexts(&state).map_err(|e| e.to_string())
}
