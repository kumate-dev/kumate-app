//! Endpoints commands (macro-generated).
//!
//! Generates: create_endpoints, update_endpoints, list_endpoints, watch_endpoints,
//! delete_endpoints
use k8s_openapi::api::core::v1::Endpoints;

crate::k8s_namespaced_commands! {
    kind: Endpoints,
    plural: "endpoints",
    create: create_endpoints,
    update: update_endpoints,
    list: list_endpoints,
    watch: watch_endpoints,
    delete: delete_endpoints,
}
