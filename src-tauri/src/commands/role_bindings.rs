//! RoleBinding commands (macro-generated).
//!
//! Generates: create_role_binding, update_role_binding, list_role_bindings,
//! watch_role_bindings, delete_role_bindings
use k8s_openapi::api::rbac::v1::RoleBinding;

crate::k8s_namespaced_commands! {
    kind: RoleBinding,
    plural: "role_bindings",
    create: create_role_binding,
    update: update_role_binding,
    list: list_role_bindings,
    watch: watch_role_bindings,
    delete: delete_role_bindings,
}
