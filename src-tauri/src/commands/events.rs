use k8s_openapi::api::core::v1::Event;
use serde_json::Value;

use crate::manager::k8s::resources::K8sResources;

#[tauri::command]
pub async fn list_events(
    context: String,
    namespaces: Option<Vec<String>>,
    field_selector: Option<String>,
) -> Result<Vec<Value>, String> {
    // `list_with_fields` returns `AppResult`; a tail expression gets no implicit
    // `From` conversion, so bridge to the legacy `String` wire shape explicitly.
    K8sResources::<Event>::list_with_fields(context, namespaces, field_selector)
        .await
        .map_err(|e| e.to_string())
}
