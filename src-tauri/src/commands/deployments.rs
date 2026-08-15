//! Deployment commands (macro-generated).
//!
//! Generates: create_deployment, update_deployment, list_deployments, watch_deployments,
//! delete_deployments, restart_deployment, scale_deployment
use k8s_openapi::api::apps::v1::Deployment;

crate::k8s_namespaced_commands! {
    kind: Deployment,
    plural: "deployments",
    create: create_deployment,
    update: update_deployment,
    list: list_deployments,
    watch: watch_deployments,
    delete: delete_deployments,
}

crate::k8s_restart_command! { kind: Deployment, restart: restart_deployment }
crate::k8s_scale_command! { kind: Deployment, scale: scale_deployment }
