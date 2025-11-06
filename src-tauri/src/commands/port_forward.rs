use crate::manager::k8s::port_forward::PortForwarder;
use crate::utils::port_forward::{PortForwardItem, PortForwardManager};
use tauri::AppHandle;

#[tauri::command]
pub async fn start_port_forward(
    app_handle: AppHandle,
    state: tauri::State<'_, PortForwardManager>,
    context: String,
    namespace: String,
    resource_kind: String,
    resource_name: String,
    local_port: u16,
    remote_port: u16,
) -> Result<serde_json::Value, String> {
    let pf = PortForwarder::new(app_handle, &state);
    pf.start(context, namespace, resource_kind, resource_name, local_port, remote_port).await
}

#[tauri::command]
pub async fn stop_port_forward(
    state: tauri::State<'_, PortForwardManager>,
    session_id: String,
) -> Result<(), String> {
    PortForwarder::stop(state, session_id).await
}

#[tauri::command]
pub async fn list_port_forwards(
    state: tauri::State<'_, PortForwardManager>,
) -> Result<Vec<PortForwardItem>, String> {
    Ok(state.list().await)
}

#[tauri::command]
pub async fn resume_port_forward(
    app_handle: AppHandle,
    state: tauri::State<'_, PortForwardManager>,
    session_id: String,
) -> Result<(), String> {
    let pf = PortForwarder::new(app_handle, &state);
    pf.resume(session_id).await
}

#[tauri::command]
pub async fn delete_port_forward(
    state: tauri::State<'_, PortForwardManager>,
    session_id: String,
) -> Result<(), String> {
    PortForwarder::delete(state, session_id).await
}
