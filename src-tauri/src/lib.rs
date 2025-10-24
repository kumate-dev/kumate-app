#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use dirs::data_dir;
use dirs::home_dir;
use std::path::PathBuf;
use tauri::Manager;

mod commands;
mod constants;
mod databases;
mod k8s;
mod state;
mod types;
mod utils;

use crate::commands::common;
use crate::commands::config_maps;
use crate::commands::contexts;
use crate::commands::cron_jobs;
use crate::commands::daemon_sets;
use crate::commands::deployments;
use crate::commands::horizontal_pod_autoscalers;
use crate::commands::jobs;
use crate::commands::limit_ranges;
use crate::commands::namespaces;
use crate::commands::nodes;
use crate::commands::pod_disruption_budgets;
use crate::commands::pods;
use crate::commands::replica_sets;
use crate::commands::replication_controllers;
use crate::commands::resource_quotas;
use crate::commands::secrets;
use crate::commands::stateful_sets;
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
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            contexts::import_kube_contexts,
            contexts::list_contexts,
            common::unwatch,
            nodes::list_nodes,
            nodes::watch_nodes,
            namespaces::list_namespaces,
            namespaces::watch_namespaces,
            pods::list_pods,
            pods::watch_pods,
            pods::delete_pods,
            deployments::list_deployments,
            deployments::watch_deployments,
            deployments::delete_deployments,
            replica_sets::list_replica_sets,
            replica_sets::watch_replica_sets,
            daemon_sets::list_daemon_sets,
            daemon_sets::watch_daemon_sets,
            stateful_sets::list_stateful_sets,
            stateful_sets::watch_stateful_sets,
            replication_controllers::list_replication_controllers,
            replication_controllers::watch_replication_controllers,
            jobs::list_jobs,
            jobs::watch_jobs,
            cron_jobs::list_cron_jobs,
            cron_jobs::watch_cron_jobs,
            config_maps::list_config_maps,
            config_maps::watch_config_maps,
            secrets::list_secrets,
            secrets::watch_secrets,
            resource_quotas::list_resource_quotas,
            resource_quotas::watch_resource_quotas,
            limit_ranges::list_limit_ranges,
            limit_ranges::watch_limit_ranges,
            horizontal_pod_autoscalers::list_horizontal_pod_autoscalers,
            horizontal_pod_autoscalers::watch_horizontal_pod_autoscalers,
            pod_disruption_budgets::list_pod_disruption_budgets,
            pod_disruption_budgets::watch_pod_disruption_budgets,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
