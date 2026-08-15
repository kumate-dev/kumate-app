//! ValidatingWebhookConfiguration commands (macro-generated).
//!
//! Generates: create_validating_webhook, update_validating_webhook,
//! list_validating_webhooks, watch_validating_webhooks, delete_validating_webhooks
use k8s_openapi::api::admissionregistration::v1::ValidatingWebhookConfiguration;

crate::k8s_cluster_commands! {
    kind: ValidatingWebhookConfiguration,
    plural: "validating_webhooks",
    create: create_validating_webhook,
    update: update_validating_webhook,
    list: list_validating_webhooks,
    watch: watch_validating_webhooks,
    delete: delete_validating_webhooks,
}
