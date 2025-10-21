#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::PathBuf;
use tauri::Manager;

mod commands;
mod k8s;
mod state;
mod types;
mod utils;

use crate::commands::common;
use crate::commands::contexts;
use crate::commands::cronjobs;
use crate::commands::daemonsets;
use crate::commands::deployments;
use crate::commands::jobs;
use crate::commands::namespaces;
use crate::commands::nodes;
use crate::commands::pods;
use crate::commands::replicasets;
use crate::commands::replicationcontrollers;
use crate::commands::statefulsets;
use crate::utils::watcher::WatchManager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Install rustls crypto provider to avoid runtime panic
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
            namespaces::list_namespaces,
            namespaces::watch_namespaces,
            pods::list_pods,
            pods::watch_pods,
            deployments::list_deployments,
            deployments::watch_deployments,
            replicasets::list_replicasets,
            replicasets::watch_replicasets,
            daemonsets::list_daemonsets,
            daemonsets::watch_daemonsets,
            statefulsets::list_statefulsets,
            statefulsets::watch_statefulsets,
            replicationcontrollers::list_replicationcontrollers,
            replicationcontrollers::watch_replicationcontrollers,
            jobs::list_jobs,
            jobs::watch_jobs,
            cronjobs::list_cronjobs,
            cronjobs::watch_cronjobs,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
