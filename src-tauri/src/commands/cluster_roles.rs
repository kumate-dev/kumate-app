//! ClusterRole commands (macro-generated).
//!
//! Generates: create_cluster_role, update_cluster_role, list_cluster_roles,
//! watch_cluster_roles, delete_cluster_roles
use k8s_openapi::api::rbac::v1::ClusterRole;

crate::k8s_cluster_commands! {
    kind: ClusterRole,
    plural: "cluster_roles",
    create: create_cluster_role,
    update: update_cluster_role,
    list: list_cluster_roles,
    watch: watch_cluster_roles,
    delete: delete_cluster_roles,
}
