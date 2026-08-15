use crate::manager::k8s::cluster_resources::K8sClusterResources;
use k8s_openapi::apiextensions_apiserver::pkg::apis::apiextensions::v1::CustomResourceDefinition;
use serde_json::Value;

#[tauri::command]
pub async fn list_custom_resource_definitions(name: String) -> Result<Vec<Value>, String> {
    // `list` returns `AppResult`; a tail expression gets no implicit `From`
    // conversion, so bridge to the legacy `String` wire shape explicitly.
    K8sClusterResources::<CustomResourceDefinition>::list(name)
        .await
        .map_err(|e| e.to_string())
}
