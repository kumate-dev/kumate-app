//! ResourceQuota commands (macro-generated).
//!
//! Generates: create_resource_quota, update_resource_quota, list_resource_quotas,
//! watch_resource_quotas, delete_resource_quotas
use k8s_openapi::api::core::v1::ResourceQuota;

crate::k8s_namespaced_commands! {
    kind: ResourceQuota,
    plural: "resource_quotas",
    create: create_resource_quota,
    update: update_resource_quota,
    list: list_resource_quotas,
    watch: watch_resource_quotas,
    delete: delete_resource_quotas,
}
