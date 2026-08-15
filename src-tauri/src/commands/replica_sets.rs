//! ReplicaSet commands (macro-generated).
//!
//! Generates: create_replica_set, update_replica_set, list_replica_sets,
//! watch_replica_sets, delete_replica_sets
use k8s_openapi::api::apps::v1::ReplicaSet;

crate::k8s_namespaced_commands! {
    kind: ReplicaSet,
    plural: "replica_sets",
    create: create_replica_set,
    update: update_replica_set,
    list: list_replica_sets,
    watch: watch_replica_sets,
    delete: delete_replica_sets,
}
