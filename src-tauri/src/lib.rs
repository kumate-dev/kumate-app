#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::PathBuf;
use tauri::Manager;

mod state;
mod utils;
mod k8s;
mod commands;

use crate::commands::contexts;
use crate::commands::nodes;
use crate::commands::namespaces;
use crate::commands::pods;
use crate::commands::deployments;
use crate::commands::daemonsets;
use crate::commands::statefulsets;
use crate::commands::replicasets;
use crate::commands::replicationcontrollers;
use crate::commands::jobs;
use crate::commands::cronjobs;



#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Install rustls crypto provider to avoid runtime panic
    let _ = rustls::crypto::aws_lc_rs::default_provider().install_default();

    tauri::Builder::default()
        .setup(|app| {
            let app_handle = app.handle();

            // Use home dir to avoid permission issues in dev
            let data_dir = dirs::home_dir().unwrap_or_else(|| PathBuf::from(".")).join(".kumate");
            // Ensure subdir for our app
            let db_path = data_dir.join("kumate.db");

            tauri::async_runtime::block_on(async move {
                let st = state::AppState::init(db_path).await.expect("init db");
                app_handle.manage(st);
            });

            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            contexts::add_context,
            contexts::list_contexts,
            contexts::get_context_secrets,
            contexts::delete_context,
            contexts::import_kube_contexts,
            nodes::list_nodes,
            namespaces::list_namespaces,
            pods::list_pods,
            deployments::list_deployments,
            daemonsets::list_daemonsets,
            statefulsets::list_statefulsets,
            replicasets::list_replicasets,
            replicationcontrollers::list_replicationcontrollers,
            jobs::list_jobs,
            cronjobs::list_cronjobs,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
