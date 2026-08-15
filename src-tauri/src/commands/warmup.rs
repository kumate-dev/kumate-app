//! Cluster warm-up: start the watches the first screens will need.
//!
//! This used to end with a detached `tokio::spawn` that fired four `list_*` calls and
//! threw every result away. The comment claimed it "populated caches", but no cache
//! existed — so it was pure connection warming that cost four full resource listings
//! per cluster switch.
//!
//! There is a cache now ([`ResourceStore`](crate::manager::k8s::store::ResourceStore)),
//! and starting a watch fills it: `kube-runtime` opens every watch with an initial
//! listing. So the watches below both establish the connection *and* populate the
//! cache, and the discarded lists are redundant. They are gone.

use serde_json::Value;
use tauri::AppHandle;
use tokio::time::{timeout, Duration};

use crate::commands::{deployments, namespaces, nodes, pods, services};
use crate::error::AppResult;
use crate::utils::watcher::WatchManager;

/// Bounded wait for the namespace listing, so a slow or unreachable cluster cannot
/// stall the UI's cluster-switch path.
const NAMESPACE_LIST_TIMEOUT: Duration = Duration::from_secs(15);

/// How many additional namespaces (beyond the well-known ones) to pre-warm.
/// Watches are not free — each one holds an open connection — so this stays small.
const EXTRA_NAMESPACE_LIMIT: usize = 4;

/// Namespaces almost every cluster has and almost every user looks at first.
const PREFERRED_NAMESPACES: [&str; 4] =
    ["kube-system", "default", "kube-public", "kube-node-lease"];

fn value_to_ns_name(v: &Value) -> Option<String> {
    v.get("metadata")
        .and_then(|m| m.get("name"))
        .and_then(|n| n.as_str())
        .map(String::from)
}

#[tauri::command]
pub async fn warmup_context(
    app_handle: AppHandle,
    name: String,
    state: tauri::State<'_, WatchManager>,
) -> AppResult<()> {
    let ns_list: Vec<Value> = match timeout(
        NAMESPACE_LIST_TIMEOUT,
        namespaces::list_namespaces(name.clone()),
    )
    .await
    {
        Ok(Ok(v)) => v,
        Ok(Err(err)) => {
            // Not fatal: we can still warm cluster-scoped watches.
            tracing::warn!(context = %name, error = %err, "warmup: listing namespaces failed");
            Vec::new()
        }
        Err(_) => {
            tracing::warn!(context = %name, "warmup: listing namespaces timed out");
            Vec::new()
        }
    };

    let selected_ns = select_namespaces(ns_list);

    // Cluster-scoped watches are always worth starting: the sidebar and the overview
    // both need them regardless of namespace selection.
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
        let _ = services::watch_services(app_handle, name.clone(), Some(selected_ns), state).await;
    }

    tracing::debug!(context = %name, "warmup complete");
    Ok(())
}

/// Well-known namespaces first (in the order listed), then the alphabetically first
/// few of whatever else exists.
fn select_namespaces(ns_list: Vec<Value>) -> Vec<String> {
    let mut available: Vec<String> = ns_list.iter().filter_map(value_to_ns_name).collect();

    let mut selected: Vec<String> = PREFERRED_NAMESPACES
        .iter()
        .filter(|p| available.iter().any(|n| n == *p))
        .map(|p| p.to_string())
        .collect();

    available.retain(|n| !selected.contains(n));
    available.sort();
    selected.extend(available.into_iter().take(EXTRA_NAMESPACE_LIMIT));

    selected
}
