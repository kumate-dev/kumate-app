//! PersistentVolume commands (macro-generated).
//!
//! Generates: create_persistent_volume, update_persistent_volume, list_persistent_volumes,
//! watch_persistent_volumes, delete_persistent_volumes
use k8s_openapi::api::core::v1::PersistentVolume;

crate::k8s_cluster_commands! {
    kind: PersistentVolume,
    plural: "persistent_volumes",
    create: create_persistent_volume,
    update: update_persistent_volume,
    list: list_persistent_volumes,
    watch: watch_persistent_volumes,
    delete: delete_persistent_volumes,
}
