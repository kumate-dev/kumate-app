use std::sync::Arc;

use tauri::AppHandle;

use crate::utils::watcher::WatchManager;

pub async fn watch<F, Fut>(
    app_handle: AppHandle,
    name: String,
    resource: String,
    namespace: Option<String>,
    state: tauri::State<'_, WatchManager>,
    watch_fn: Arc<F>,
) -> Result<String, String>
where
    F: Fn(AppHandle, String, Option<String>, String) -> Fut + Send + Sync + 'static,
    Fut: std::future::Future<Output = Result<(), String>> + Send + 'static,
{
    let ns: String = namespace.unwrap_or_else(|| "default".to_string());
    let event_name: Arc<String> = Arc::new(format!("k8s://{}/{}/{}", name, resource, ns));
    let event_name_clone: Arc<String> = Arc::clone(&event_name);

    state
        .watch(app_handle, name.clone(), move |app_handle, name| {
            let event_name_inner = Arc::clone(&event_name_clone);
            let ns_inner = ns.clone();
            let watch_fn_inner = Arc::clone(&watch_fn);
            async move {
                watch_fn_inner(
                    app_handle,
                    name,
                    Some(ns_inner),
                    event_name_inner.to_string(),
                )
                .await
            }
        })
        .await?;

    Ok(event_name.to_string())
}

pub async fn watch_all<F, Fut>(
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
    let ns: Option<Vec<String>> = namespaces.filter(|v| !v.is_empty());

    let event_name: String = format!("k8s://{}/{}", name, resource);
    let event_name_arc: Arc<String> = Arc::new(event_name.clone());
    let watch_fn_clone: Arc<F> = Arc::clone(&watch_fn);
    let ns_clone: Option<Vec<String>> = ns.clone();
    let name_clone: String = name.clone();
    let app_handle_clone: AppHandle = app_handle.clone();

    state
        .watch(app_handle_clone, name_clone, move |app_handle, name| {
            let event_name_inner: Arc<String> = Arc::clone(&event_name_arc);
            let ns_inner: Option<Vec<String>> = ns_clone.clone();
            let watch_fn_inner: Arc<F> = Arc::clone(&watch_fn_clone);
            async move {
                watch_fn_inner(
                    app_handle,
                    name,
                    ns_inner,
                    event_name_inner.to_string(),
                )
                .await
            }
        })
        .await?;

    Ok(event_name)
}

#[tauri::command]
pub async fn unwatch(state: tauri::State<'_, WatchManager>, name: String) -> Result<(), String> {
    println!("unwatch: name={}", name);
    state.unwatch(&name).await
}
