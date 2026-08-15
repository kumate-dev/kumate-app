//! Service commands (macro-generated).
//!
//! Generates: create_service, update_service, list_services, watch_services,
//! delete_services
use k8s_openapi::api::core::v1::Service;

crate::k8s_namespaced_commands! {
    kind: Service,
    plural: "services",
    create: create_service,
    update: update_service,
    list: list_services,
    watch: watch_services,
    delete: delete_services,
}
