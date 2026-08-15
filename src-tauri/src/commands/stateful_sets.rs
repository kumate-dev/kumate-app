//! StatefulSet commands (macro-generated).
//!
//! Generates: create_stateful_set, update_stateful_set, list_stateful_sets,
//! watch_stateful_sets, delete_stateful_sets, restart_stateful_set, scale_stateful_set
use k8s_openapi::api::apps::v1::StatefulSet;

crate::k8s_namespaced_commands! {
    kind: StatefulSet,
    plural: "stateful_sets",
    create: create_stateful_set,
    update: update_stateful_set,
    list: list_stateful_sets,
    watch: watch_stateful_sets,
    delete: delete_stateful_sets,
}

crate::k8s_restart_command! { kind: StatefulSet, restart: restart_stateful_set }
crate::k8s_scale_command! { kind: StatefulSet, scale: scale_stateful_set }
