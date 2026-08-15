//! DaemonSet commands (macro-generated).
//!
//! Generates: create_daemon_set, update_daemon_set, list_daemon_sets, watch_daemon_sets,
//! delete_daemon_sets, restart_daemon_set, scale_daemon_set
use k8s_openapi::api::apps::v1::DaemonSet;

crate::k8s_namespaced_commands! {
    kind: DaemonSet,
    plural: "daemon_sets",
    create: create_daemon_set,
    update: update_daemon_set,
    list: list_daemon_sets,
    watch: watch_daemon_sets,
    delete: delete_daemon_sets,
}

crate::k8s_restart_command! { kind: DaemonSet, restart: restart_daemon_set }
crate::k8s_scale_command! { kind: DaemonSet, scale: scale_daemon_set }
