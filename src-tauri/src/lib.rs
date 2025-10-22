#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::PathBuf;
use tauri::Manager;

mod commands;
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
use crate::commands::jobs;
use crate::commands::limit_ranges;
use crate::commands::namespaces;
use crate::commands::nodes;
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
            let app_handle = app.handle();

            // Use home dir to avoid permission issues in dev
            let data_dir = dirs::home_dir()
                .unwrap_or_else(|| PathBuf::from("."))
                .join(".kumate");
            // Ensure subdir for our app
            let db_path = data_dir.join("kumate.db");

            tauri::async_runtime::block_on(async move {
                let st = state::AppState::init(db_path).await.expect("init db");
                app_handle.manage(st);
            });

            Ok(())
        })
        .manage(WatchManager::default())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            contexts::add_context,
            contexts::list_contexts,
            contexts::get_context_secrets,
            contexts::delete_context,
            contexts::import_kube_contexts,
            common::unwatch,
            nodes::list_nodes,
            nodes::watch_nodes,
            namespaces::list_namespaces,
            namespaces::watch_namespaces,
            pods::list_pods,
            pods::watch_pods,
            deployments::list_deployments,
            deployments::watch_deployments,
            replica_sets::list_replicasets,
            replica_sets::watch_replicasets,
            daemon_sets::list_daemonsets,
            daemon_sets::watch_daemonsets,
            stateful_sets::list_statefulsets,
            stateful_sets::watch_statefulsets,
            replication_controllers::list_replicationcontrollers,
            replication_controllers::watch_replicationcontrollers,
            jobs::list_jobs,
            jobs::watch_jobs,
            cron_jobs::list_cronjobs,
            cron_jobs::watch_cronjobs,
            config_maps::list_configmaps,
            config_maps::watch_configmaps,
            secrets::list_secrets,
            secrets::watch_secrets,
            resource_quotas::list_resource_quotas,
            resource_quotas::watch_resource_quotas,
            limit_ranges::list_limitranges,
            limit_ranges::watch_limitranges,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
