//! RuntimeClass commands (macro-generated).
//!
//! Generates: create_runtime_class, update_runtime_class, list_runtime_classes,
//! watch_runtime_classes, delete_runtime_classes
use k8s_openapi::api::node::v1::RuntimeClass;

crate::k8s_cluster_commands! {
    kind: RuntimeClass,
    plural: "runtime_classes",
    create: create_runtime_class,
    update: update_runtime_class,
    list: list_runtime_classes,
    watch: watch_runtime_classes,
    delete: delete_runtime_classes,
}
