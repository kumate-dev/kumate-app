//! ReplicationController commands (macro-generated).
//!
//! Generates: create_replication_controller, update_replication_controller,
//! list_replication_controllers, watch_replication_controllers,
//! delete_replication_controllers, restart_replication_controller,
//! scale_replication_controller
use k8s_openapi::api::core::v1::ReplicationController;

crate::k8s_namespaced_commands! {
    kind: ReplicationController,
    plural: "replication_controllers",
    create: create_replication_controller,
    update: update_replication_controller,
    list: list_replication_controllers,
    watch: watch_replication_controllers,
    delete: delete_replication_controllers,
}

crate::k8s_restart_command! { kind: ReplicationController, restart: restart_replication_controller }
crate::k8s_scale_command! { kind: ReplicationController, scale: scale_replication_controller }
