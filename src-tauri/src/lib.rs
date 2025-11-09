#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use dirs::data_dir;
use dirs::home_dir;
use std::path::PathBuf;
use tauri::Manager;

mod commands;
mod constants;
mod databases;
#[path = "manager/mod.rs"]
mod manager;
mod state;
mod types;
mod utils;

use crate::commands::cluster_role_bindings;
use crate::commands::cluster_roles;
use crate::commands::common;
use crate::commands::config_maps;
use crate::commands::contexts;
use crate::commands::crd_definitions;
use crate::commands::cron_jobs;
use crate::commands::custom_resources;
use crate::commands::daemon_sets;
use crate::commands::deployments;
use crate::commands::endpoints;
use crate::commands::helm;
use crate::commands::horizontal_pod_autoscalers;
use crate::commands::ingress_classes;
use crate::commands::ingresses;
use crate::commands::jobs;
use crate::commands::leases;
use crate::commands::limit_ranges;
use crate::commands::mutating_webhooks;
use crate::commands::namespaces;
use crate::commands::network_policies;
use crate::commands::nodes;
use crate::commands::persistent_volume_claims;
use crate::commands::persistent_volumes;
use crate::commands::pod_disruption_budgets;
use crate::commands::pods;
use crate::commands::port_forward;
use crate::commands::priority_classes;
use crate::commands::replica_sets;
use crate::commands::replication_controllers;
use crate::commands::resource_quotas;
use crate::commands::role_bindings;
use crate::commands::roles;
use crate::commands::runtime_classes;
use crate::commands::secrets;
use crate::commands::service_accounts;
use crate::commands::services;
use crate::commands::stateful_sets;
use crate::commands::storage_classes;
use crate::commands::validating_webhooks;
use crate::utils::watcher::WatchManager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = rustls::crypto::aws_lc_rs::default_provider().install_default();

    tauri::Builder::default()
        .setup(|app| {
            let app_handle: &tauri::AppHandle = app.handle();

            let data_dir: PathBuf = data_dir()
                .unwrap_or_else(|| home_dir().unwrap_or_else(|| PathBuf::from(".")))
                .join("Kumate");

            tauri::async_runtime::block_on(async move {
                let st: state::AppState = state::AppState::init(data_dir).await.expect("init db");
                app_handle.manage(st);
            });

            Ok(())
        })
        .manage(WatchManager::default())
        .manage(crate::utils::exec::ExecManager::default())
        .manage(crate::utils::port_forward::PortForwardManager::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            contexts::import_kube_contexts,
            contexts::list_contexts,
            common::unwatch,
            nodes::list_nodes,
            nodes::watch_nodes,
            nodes::delete_nodes,
            namespaces::list_namespaces,
            namespaces::watch_namespaces,
            namespaces::delete_namespaces,
            pods::create_pod,
            pods::update_pod,
            pods::list_pods,
            pods::watch_pods,
            pods::delete_pods,
            pods::get_pod_logs,
            pods::watch_pod_logs,
            pods::exec_pod,
            pods::start_exec_pod,
            pods::send_exec_input,
            pods::stop_exec_pod,
            priority_classes::create_priority_class,
            priority_classes::update_priority_class,
            priority_classes::list_priority_classes,
            priority_classes::watch_priority_classes,
            priority_classes::delete_priority_classes,
            runtime_classes::create_runtime_class,
            runtime_classes::update_runtime_class,
            runtime_classes::list_runtime_classes,
            runtime_classes::watch_runtime_classes,
            runtime_classes::delete_runtime_classes,
            storage_classes::create_storage_class,
            storage_classes::update_storage_class,
            storage_classes::list_storage_classes,
            storage_classes::watch_storage_classes,
            storage_classes::delete_storage_classes,
            service_accounts::create_service_account,
            service_accounts::update_service_account,
            service_accounts::list_service_accounts,
            service_accounts::watch_service_accounts,
            service_accounts::delete_service_accounts,
            roles::create_role,
            roles::update_role,
            roles::list_roles,
            roles::watch_roles,
            roles::delete_roles,
            cluster_roles::create_cluster_role,
            cluster_roles::update_cluster_role,
            cluster_roles::list_cluster_roles,
            cluster_roles::watch_cluster_roles,
            cluster_roles::delete_cluster_roles,
            role_bindings::create_role_binding,
            role_bindings::update_role_binding,
            role_bindings::list_role_bindings,
            role_bindings::watch_role_bindings,
            role_bindings::delete_role_bindings,
            cluster_role_bindings::create_cluster_role_binding,
            cluster_role_bindings::update_cluster_role_binding,
            cluster_role_bindings::list_cluster_role_bindings,
            cluster_role_bindings::watch_cluster_role_bindings,
            cluster_role_bindings::delete_cluster_role_bindings,
            deployments::create_deployment,
            deployments::update_deployment,
            deployments::restart_deployment,
            deployments::scale_deployment,
            deployments::list_deployments,
            deployments::watch_deployments,
            deployments::delete_deployments,
            replica_sets::create_replica_set,
            replica_sets::update_replica_set,
            replica_sets::list_replica_sets,
            replica_sets::watch_replica_sets,
            replica_sets::delete_replica_sets,
            daemon_sets::create_daemon_set,
            daemon_sets::update_daemon_set,
            daemon_sets::restart_daemon_set,
            daemon_sets::scale_daemon_set,
            daemon_sets::list_daemon_sets,
            daemon_sets::watch_daemon_sets,
            daemon_sets::delete_daemon_sets,
            stateful_sets::create_stateful_set,
            stateful_sets::update_stateful_set,
            stateful_sets::restart_stateful_set,
            stateful_sets::scale_stateful_set,
            stateful_sets::list_stateful_sets,
            stateful_sets::watch_stateful_sets,
            stateful_sets::delete_stateful_sets,
            replication_controllers::create_replication_controller,
            replication_controllers::update_replication_controller,
            replication_controllers::restart_replication_controller,
            replication_controllers::scale_replication_controller,
            replication_controllers::list_replication_controllers,
            replication_controllers::watch_replication_controllers,
            replication_controllers::delete_replication_controllers,
            jobs::create_job,
            jobs::update_job,
            jobs::list_jobs,
            jobs::watch_jobs,
            jobs::delete_jobs,
            cron_jobs::create_cron_job,
            cron_jobs::update_cron_job,
            cron_jobs::suspend_cron_job,
            cron_jobs::list_cron_jobs,
            cron_jobs::watch_cron_jobs,
            cron_jobs::delete_cron_jobs,
            config_maps::create_config_map,
            config_maps::update_config_map,
            config_maps::list_config_maps,
            config_maps::watch_config_maps,
            config_maps::delete_config_maps,
            secrets::create_secret,
            secrets::update_secret,
            secrets::list_secrets,
            secrets::watch_secrets,
            secrets::delete_secrets,
            resource_quotas::list_resource_quotas,
            resource_quotas::watch_resource_quotas,
            resource_quotas::delete_resource_quotas,
            limit_ranges::list_limit_ranges,
            limit_ranges::watch_limit_ranges,
            limit_ranges::delete_limit_ranges,
            horizontal_pod_autoscalers::list_horizontal_pod_autoscalers,
            horizontal_pod_autoscalers::watch_horizontal_pod_autoscalers,
            horizontal_pod_autoscalers::delete_horizontal_pod_autoscalers,
            pod_disruption_budgets::list_pod_disruption_budgets,
            pod_disruption_budgets::watch_pod_disruption_budgets,
            pod_disruption_budgets::delete_pod_disruption_budgets,
            services::create_service,
            services::update_service,
            services::list_services,
            services::watch_services,
            services::delete_services,
            leases::create_lease,
            leases::update_lease,
            leases::list_leases,
            leases::watch_leases,
            leases::delete_leases,
            mutating_webhooks::create_mutating_webhook,
            mutating_webhooks::update_mutating_webhook,
            mutating_webhooks::list_mutating_webhooks,
            mutating_webhooks::watch_mutating_webhooks,
            mutating_webhooks::delete_mutating_webhooks,
            validating_webhooks::create_validating_webhook,
            validating_webhooks::update_validating_webhook,
            validating_webhooks::list_validating_webhooks,
            validating_webhooks::watch_validating_webhooks,
            validating_webhooks::delete_validating_webhooks,
            persistent_volumes::create_persistent_volume,
            persistent_volumes::update_persistent_volume,
            persistent_volumes::list_persistent_volumes,
            persistent_volumes::watch_persistent_volumes,
            persistent_volumes::delete_persistent_volumes,
            persistent_volume_claims::create_persistent_volume_claim,
            persistent_volume_claims::update_persistent_volume_claim,
            persistent_volume_claims::list_persistent_volume_claims,
            persistent_volume_claims::watch_persistent_volume_claims,
            persistent_volume_claims::delete_persistent_volume_claims,
            endpoints::create_endpoints,
            endpoints::update_endpoints,
            endpoints::list_endpoints,
            endpoints::watch_endpoints,
            endpoints::delete_endpoints,
            ingresses::create_ingress,
            ingresses::update_ingress,
            ingresses::list_ingresses,
            ingresses::watch_ingresses,
            ingresses::delete_ingresses,
            ingress_classes::create_ingress_class,
            ingress_classes::update_ingress_class,
            ingress_classes::list_ingress_classes,
            ingress_classes::watch_ingress_classes,
            ingress_classes::delete_ingress_classes,
            network_policies::create_network_policy,
            network_policies::update_network_policy,
            network_policies::list_network_policies,
            network_policies::watch_network_policies,
            network_policies::delete_network_policies,
            helm::helm_list_charts,
            helm::helm_list_releases,
            helm::helm_uninstall_releases,
            helm::watch_helm_releases,
            custom_resources::create_custom_resource,
            custom_resources::update_custom_resource,
            custom_resources::list_custom_resources,
            custom_resources::watch_custom_resources,
            custom_resources::delete_custom_resources,
            crd_definitions::list_custom_resource_definitions,
            port_forward::start_port_forward,
            port_forward::stop_port_forward,
            port_forward::list_port_forwards,
            port_forward::resume_port_forward,
            port_forward::delete_port_forward,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
