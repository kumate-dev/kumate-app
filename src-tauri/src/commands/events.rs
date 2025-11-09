use k8s_openapi::api::core::v1::Event;
use serde_json::Value;

use crate::manager::k8s::resources::K8sResources;

#[tauri::command]
pub async fn list_events(
    context: String,
    namespaces: Option<Vec<String>>,
    field_selector: Option<String>,
) -> Result<Vec<Value>, String> {
    K8sResources::<Event>::list_with_fields(context, namespaces, field_selector).await
}
