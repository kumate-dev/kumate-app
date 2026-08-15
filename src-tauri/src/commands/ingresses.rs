//! Ingress commands (macro-generated).
//!
//! Generates: create_ingress, update_ingress, list_ingresses, watch_ingresses,
//! delete_ingresses
use k8s_openapi::api::networking::v1::Ingress;

crate::k8s_namespaced_commands! {
    kind: Ingress,
    plural: "ingresses",
    create: create_ingress,
    update: update_ingress,
    list: list_ingresses,
    watch: watch_ingresses,
    delete: delete_ingresses,
}
