use std::sync::Arc;

use k8s_openapi::chrono;
use serde_json::Value;
use tauri::AppHandle;

use crate::utils::watcher::WatchManager;

pub async fn watch<F, Fut>(
    app_handle: AppHandle,
    name: String,
    resource: String,
    namespaces: Option<Vec<String>>,
    state: tauri::State<'_, WatchManager>,
    watch_fn: Arc<F>,
) -> Result<String, String>
where
    F: Fn(AppHandle, String, Option<Vec<String>>, String) -> Fut + Send + Sync + 'static,
    Fut: std::future::Future<Output = Result<(), String>> + Send + 'static,
{
    let mut target_namespaces: Option<Vec<String>> = namespaces.filter(|v| !v.is_empty());
    if let Some(ref mut ns) = target_namespaces {
        ns.sort();
    }

    let event_name: String = match &target_namespaces {
        Some(ns) => {
            let ns_part = ns.join(",");
            format!("k8s://{}/{}/ns/{}", name, resource, ns_part)
        }
        None => format!("k8s://{}/{}", name, resource),
    };
    let event_name_arc: Arc<String> = Arc::new(event_name.clone());
    let watch_fn_clone: Arc<F> = Arc::clone(&watch_fn);
    let name_clone: String = name.clone();
    let app_handle_clone: AppHandle = app_handle.clone();

    state
        .watch(app_handle_clone, event_name.clone(), move |app_handle, _watch_id| {
            let event_name_inner: Arc<String> = Arc::clone(&event_name_arc);
            let ns_inner: Option<Vec<String>> = target_namespaces.clone();
            let watch_fn_inner: Arc<F> = Arc::clone(&watch_fn_clone);
            let cluster_name = name_clone.clone();
            async move {
                watch_fn_inner(app_handle, cluster_name, ns_inner, event_name_inner.to_string())
                    .await
            }
        })
        .await?;

    Ok(event_name)
}

#[tauri::command]
pub async fn unwatch(state: tauri::State<'_, WatchManager>, name: String) -> Result<(), String> {
    state.unwatch(&name).await
}

pub fn restart_patch() -> Value {
    serde_json::json!({
        "spec": {
            "template": {
                "metadata": {
                    "annotations": {
                        "kumate.dev/restartedAt": chrono::Utc::now().to_rfc3339()
                    }
                }
            }
        }
    })
}

pub fn scale_patch(replicas: i32) -> Value {
    serde_json::json!({
        "spec": { "replicas": replicas }
    })
}
