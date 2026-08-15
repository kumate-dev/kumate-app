//! Role commands (macro-generated).
//!
//! Generates: create_role, update_role, list_roles, watch_roles, delete_roles
use k8s_openapi::api::rbac::v1::Role;

crate::k8s_namespaced_commands! {
    kind: Role,
    plural: "roles",
    create: create_role,
    update: update_role,
    list: list_roles,
    watch: watch_roles,
    delete: delete_roles,
}
