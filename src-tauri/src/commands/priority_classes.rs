//! PriorityClass commands (macro-generated).
//!
//! Generates: create_priority_class, update_priority_class, list_priority_classes,
//! watch_priority_classes, delete_priority_classes
use k8s_openapi::api::scheduling::v1::PriorityClass;

crate::k8s_cluster_commands! {
    kind: PriorityClass,
    plural: "priority_classes",
    create: create_priority_class,
    update: update_priority_class,
    list: list_priority_classes,
    watch: watch_priority_classes,
    delete: delete_priority_classes,
}
