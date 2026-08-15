//! PersistentVolumeClaim commands (macro-generated).
//!
//! Generates: create_persistent_volume_claim, update_persistent_volume_claim,
//! list_persistent_volume_claims, watch_persistent_volume_claims,
//! delete_persistent_volume_claims
use k8s_openapi::api::core::v1::PersistentVolumeClaim;

crate::k8s_namespaced_commands! {
    kind: PersistentVolumeClaim,
    plural: "persistent_volume_claims",
    create: create_persistent_volume_claim,
    update: update_persistent_volume_claim,
    list: list_persistent_volume_claims,
    watch: watch_persistent_volume_claims,
    delete: delete_persistent_volume_claims,
}
