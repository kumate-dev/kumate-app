//! ConfigMap commands (macro-generated).
//!
//! Generates: create_config_map, update_config_map, list_config_maps, watch_config_maps,
//! delete_config_maps, patch_config_map
use k8s_openapi::api::core::v1::ConfigMap;

crate::k8s_namespaced_commands! {
    kind: ConfigMap,
    plural: "config_maps",
    create: create_config_map,
    update: update_config_map,
    list: list_config_maps,
    watch: watch_config_maps,
    delete: delete_config_maps,
}

// Per-key editing of `data` needs a partial write: a merge patch that sets one map
// entry (or `null` to delete it). `update` would replace the whole object, including
// the `managedFields` the watch layer strips, and would clobber concurrent edits.
crate::k8s_patch_command! { kind: ConfigMap, patch: patch_config_map }
