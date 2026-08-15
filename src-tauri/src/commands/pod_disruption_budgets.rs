//! PodDisruptionBudget commands (macro-generated).
//!
//! Generates: create_pod_disruption_budget, update_pod_disruption_budget,
//! list_pod_disruption_budgets, watch_pod_disruption_budgets, delete_pod_disruption_budgets
use k8s_openapi::api::policy::v1::PodDisruptionBudget;

crate::k8s_namespaced_commands! {
    kind: PodDisruptionBudget,
    plural: "pod_disruption_budgets",
    create: create_pod_disruption_budget,
    update: update_pod_disruption_budget,
    list: list_pod_disruption_budgets,
    watch: watch_pod_disruption_budgets,
    delete: delete_pod_disruption_budgets,
}
