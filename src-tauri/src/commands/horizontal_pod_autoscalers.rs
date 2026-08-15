//! HorizontalPodAutoscaler commands (macro-generated).
//!
//! Generates: create_horizontal_pod_autoscaler, update_horizontal_pod_autoscaler,
//! list_horizontal_pod_autoscalers, watch_horizontal_pod_autoscalers,
//! delete_horizontal_pod_autoscalers
use k8s_openapi::api::autoscaling::v1::HorizontalPodAutoscaler;

crate::k8s_namespaced_commands! {
    kind: HorizontalPodAutoscaler,
    plural: "horizontal_pod_autoscalers",
    create: create_horizontal_pod_autoscaler,
    update: update_horizontal_pod_autoscaler,
    list: list_horizontal_pod_autoscalers,
    watch: watch_horizontal_pod_autoscalers,
    delete: delete_horizontal_pod_autoscalers,
}
