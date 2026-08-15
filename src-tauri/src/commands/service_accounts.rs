//! ServiceAccount commands (macro-generated).
//!
//! Generates: create_service_account, update_service_account, list_service_accounts,
//! watch_service_accounts, delete_service_accounts
use k8s_openapi::api::core::v1::ServiceAccount;

crate::k8s_namespaced_commands! {
    kind: ServiceAccount,
    plural: "service_accounts",
    create: create_service_account,
    update: update_service_account,
    list: list_service_accounts,
    watch: watch_service_accounts,
    delete: delete_service_accounts,
}
