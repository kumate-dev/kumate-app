//! MutatingWebhookConfiguration commands (macro-generated).
//!
//! Generates: create_mutating_webhook, update_mutating_webhook, list_mutating_webhooks,
//! watch_mutating_webhooks, delete_mutating_webhooks
use k8s_openapi::api::admissionregistration::v1::MutatingWebhookConfiguration;

crate::k8s_cluster_commands! {
    kind: MutatingWebhookConfiguration,
    plural: "mutating_webhooks",
    create: create_mutating_webhook,
    update: update_mutating_webhook,
    list: list_mutating_webhooks,
    watch: watch_mutating_webhooks,
    delete: delete_mutating_webhooks,
}
