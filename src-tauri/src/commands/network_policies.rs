//! NetworkPolicy commands (macro-generated).
//!
//! Generates: create_network_policy, update_network_policy, list_network_policies,
//! watch_network_policies, delete_network_policies
use k8s_openapi::api::networking::v1::NetworkPolicy;

crate::k8s_namespaced_commands! {
    kind: NetworkPolicy,
    plural: "network_policies",
    create: create_network_policy,
    update: update_network_policy,
    list: list_network_policies,
    watch: watch_network_policies,
    delete: delete_network_policies,
}
