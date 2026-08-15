//! StorageClass commands (macro-generated).
//!
//! Generates: create_storage_class, update_storage_class, list_storage_classes,
//! watch_storage_classes, delete_storage_classes
use k8s_openapi::api::storage::v1::StorageClass;

crate::k8s_cluster_commands! {
    kind: StorageClass,
    plural: "storage_classes",
    create: create_storage_class,
    update: update_storage_class,
    list: list_storage_classes,
    watch: watch_storage_classes,
    delete: delete_storage_classes,
}
