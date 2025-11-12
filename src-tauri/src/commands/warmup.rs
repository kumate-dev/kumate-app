use serde_json::Value;
use tauri::AppHandle;

use crate::commands::{deployments, namespaces, nodes, pods, services};
use crate::utils::watcher::WatchManager;

fn value_to_ns_name(v: &Value) -> Option<String> {
    v.get("metadata").and_then(|m| m.get("name")).and_then(|n| n.as_str()).map(|s| s.to_string())
}

#[tauri::command]
pub async fn warmup_context(
    app_handle: AppHandle,
    name: String,
    state: tauri::State<'_, WatchManager>,
) -> Result<(), String> {
    use tokio::time::{timeout, Duration};

    let ns_list: Vec<Value> =
        match timeout(Duration::from_secs(15), namespaces::list_namespaces(name.clone())).await {
            Ok(Ok(v)) => v,
            Ok(Err(e)) => {
                eprintln!("warmup: list_namespaces error: {}", e);
                Vec::new()
            }
            Err(_) => {
                eprintln!("warmup: list_namespaces timed out");
                Vec::new()
            }
        };

    let mut ns_names: Vec<String> = ns_list.iter().filter_map(value_to_ns_name).collect();

    // Ensure some common system namespaces are included at the beginning if present
    let preferred = ["kube-system", "default", "kube-public", "kube-node-lease"];

    let mut selected_ns: Vec<String> = Vec::new();
    for p in preferred.iter() {
        if ns_names.iter().any(|n| n == p) {
            selected_ns.push(p.to_string());
        }
    }

    ns_names.retain(|n| !selected_ns.iter().any(|s| s == n));
    ns_names.sort();
    for n in ns_names.into_iter().take(4) {
        selected_ns.push(n);
    }

    let _ = namespaces::watch_namespaces(app_handle.clone(), name.clone(), state.clone()).await;
    let _ = nodes::watch_nodes(app_handle.clone(), name.clone(), state.clone()).await;
    if !selected_ns.is_empty() {
        let _ = pods::watch_pods(
            app_handle.clone(),
            name.clone(),
            Some(selected_ns.clone()),
            state.clone(),
        )
        .await;
        let _ = deployments::watch_deployments(
            app_handle.clone(),
            name.clone(),
            Some(selected_ns.clone()),
            state.clone(),
        )
        .await;
        let _ = services::watch_services(
            app_handle.clone(),
            name.clone(),
            Some(selected_ns.clone()),
            state.clone(),
        )
        .await;
    }

    // 3) Kick off a few list calls in the background with conservative timeouts
    //    This helps establish connections and populate caches for initial views.
    let name_nodes = name.clone();
    let name_pods = name.clone();
    let name_deployments = name.clone();
    let name_services = name.clone();

    let ns_for_lists = selected_ns.clone();

    let _ = tokio::spawn(async move {
        let _ = timeout(Duration::from_secs(10), nodes::list_nodes(name_nodes)).await;
        let _ = timeout(
            Duration::from_secs(10),
            pods::list_pods(name_pods, Some(ns_for_lists.clone())),
        )
        .await;
        let _ = timeout(
            Duration::from_secs(10),
            deployments::list_deployments(name_deployments, Some(ns_for_lists.clone())),
        )
        .await;
        let _ = timeout(
            Duration::from_secs(10),
            services::list_services(name_services, Some(ns_for_lists)),
        )
        .await;
    });

    Ok(())
}
