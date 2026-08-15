//! IngressClass commands (macro-generated).
//!
//! Generates: create_ingress_class, update_ingress_class, list_ingress_classes,
//! watch_ingress_classes, delete_ingress_classes
use k8s_openapi::api::networking::v1::IngressClass;

crate::k8s_cluster_commands! {
    kind: IngressClass,
    plural: "ingress_classes",
    create: create_ingress_class,
    update: update_ingress_class,
    list: list_ingress_classes,
    watch: watch_ingress_classes,
    delete: delete_ingress_classes,
}
