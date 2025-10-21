use k8s_openapi::apimachinery::pkg::apis::meta::v1::Time;
use kube::api::ObjectMeta;

const DEFAULT_NAMESPACE: &str = "default";

pub fn to_namespace(namespace: Option<String>) -> String {
    namespace.unwrap_or(DEFAULT_NAMESPACE.to_string())
}

pub fn to_replicas_ready(replicas: i32, ready: i32) -> String {
    format!("{}/{}", ready, replicas)
}

pub fn to_creation_timestamp(metadata: ObjectMeta) -> Option<String> {
    metadata.creation_timestamp.map(|t: Time| t.0.to_rfc3339())
}
