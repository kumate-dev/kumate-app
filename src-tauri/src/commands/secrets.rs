//! Secret commands (macro-generated).
//!
//! Generates: create_secret, update_secret, list_secrets, watch_secrets, delete_secrets, patch_secret
use k8s_openapi::api::core::v1::Secret;

crate::k8s_namespaced_commands! {
    kind: Secret,
    plural: "secrets",
    create: create_secret,
    update: update_secret,
    list: list_secrets,
    watch: watch_secrets,
    delete: delete_secrets,
}

// Per-key editing of `data` needs a partial write: a merge patch that sets one map
// entry (or `null` to delete it). `update` would replace the whole object, including
// the `managedFields` the watch layer strips, and would clobber concurrent edits.
crate::k8s_patch_command! { kind: Secret, patch: patch_secret }
