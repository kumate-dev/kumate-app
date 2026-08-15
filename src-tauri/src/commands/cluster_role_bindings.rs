//! ClusterRoleBinding commands (macro-generated).
//!
//! Generates: create_cluster_role_binding, update_cluster_role_binding,
//! list_cluster_role_bindings, watch_cluster_role_bindings, delete_cluster_role_bindings
use k8s_openapi::api::rbac::v1::ClusterRoleBinding;

crate::k8s_cluster_commands! {
    kind: ClusterRoleBinding,
    plural: "cluster_role_bindings",
    create: create_cluster_role_binding,
    update: update_cluster_role_binding,
    list: list_cluster_role_bindings,
    watch: watch_cluster_role_bindings,
    delete: delete_cluster_role_bindings,
}
