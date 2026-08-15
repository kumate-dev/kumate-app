//! Lease commands (macro-generated).
//!
//! Generates: create_lease, update_lease, list_leases, watch_leases, delete_leases
use k8s_openapi::api::coordination::v1::Lease;

crate::k8s_namespaced_commands! {
    kind: Lease,
    plural: "leases",
    create: create_lease,
    update: update_lease,
    list: list_leases,
    watch: watch_leases,
    delete: delete_leases,
}
