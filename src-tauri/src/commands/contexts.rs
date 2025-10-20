use std::{fs::FileType, path::PathBuf};

use serde::{Deserialize, Serialize};

use crate::{k8s::contexts::{K8sContexts, KCNamedCluster, KCNamedContext, KCNamedUser, KubeConfigOut, KubeConfigRaw, OutNamedCluster, OutNamedContext, OutNamedUser}, state::AppState, utils::crypto::{self, Crypto}};
use base64::{engine::general_purpose::STANDARD, Engine};


#[derive(Deserialize)]
pub struct AddContextPayload {
    pub name: String,
    pub cluster: Option<String>,
    pub user: Option<String>,
    pub namespace: Option<String>,
    pub kubeconfig: String,
    pub token: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, sqlx::FromRow)]
pub struct Context {
    pub id: i64,
    pub name: String,
    pub cluster: Option<String>,
    pub user: Option<String>,
    pub namespace: Option<String>,
}

#[tauri::command]
pub async fn add_context(
    state: tauri::State<'_, AppState>,
    payload: AddContextPayload,
) -> Result<(), String> {
    let crypto: Crypto = Crypto::init().map_err(|e| e.to_string())?;

    let kc_enc: Vec<u8> = crypto
        .encrypt(payload.kubeconfig.as_bytes())
        .map_err(|e: anyhow::Error| e.to_string())?;
    let token_enc: Vec<u8> = crypto
        .encrypt(payload.token.as_bytes())
        .map_err(|e: anyhow::Error| e.to_string())?;

    let kc_b64: String = STANDARD.encode(kc_enc);
    let token_b64: String = STANDARD.encode(token_enc);

    let kc_key: String = format!("ctx:{}:kubeconfig", payload.name);
    let token_key: String = format!("ctx:{}:token", payload.name);

    crypto::secrets_set(&kc_key, &kc_b64).map_err(|e| e.to_string())?;
    crypto::secrets_set(&token_key, &token_b64).map_err(|e| e.to_string())?;

    sqlx::query(
        r#"INSERT INTO contexts(name, cluster, user, namespace) VALUES(?, ?, ?, ?)"#,
    )
    .bind(&payload.name)
    .bind(&payload.cluster)
    .bind(&payload.user)
    .bind(&payload.namespace)
    .execute(&state.db)
    .await
    .map_err(|e: sqlx::Error| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn get_context_secrets(name: String) -> Result<(String, String), String> {
  K8sContexts::get_context_secrets(&name).await
}

#[tauri::command]
pub async fn list_contexts(state: tauri::State<'_, AppState>) -> Result<Vec<Context>, String> {
    let rows = sqlx::query_as::<_, Context>(
        r#"SELECT id, name, cluster, user, namespace FROM contexts ORDER BY name"#,
    )
    .fetch_all(&state.db)
    .await
    .map_err(|e| e.to_string())?;
    Ok(rows)
}

#[tauri::command]
pub async fn delete_context(state: tauri::State<'_, AppState>, name: String) -> Result<(), String> {
    let kc_key: String = format!("ctx:{}:kubeconfig", name);
    let token_key: String = format!("ctx:{}:token", name);

    let _ = crypto::secrets_delete(&kc_key);
    let _ = crypto::secrets_delete(&token_key);

    sqlx::query(r#"DELETE FROM contexts WHERE name = ?"#)
        .bind(name)
        .execute(&state.db)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub async fn import_kube_contexts(state: tauri::State<'_, AppState>) -> Result<usize, String> {
  let home: PathBuf = dirs::home_dir().ok_or_else(|| "home dir not found".to_string())?;
  let kube_dir: PathBuf = home.join(".kube");
  println!("import_kube_contexts: scanning {:?}", kube_dir);
  let mut imported: usize = 0usize;

  let existing: Vec<String> = sqlx::query_scalar("SELECT name FROM contexts")
    .fetch_all(&state.db)
    .await
    .map_err(|e: sqlx::Error| e.to_string())?;
  println!("import_kube_contexts: existing {}", existing.len());

  let mut rd: tokio::fs::ReadDir = match tokio::fs::read_dir(&kube_dir).await {
    Ok(r) => r,
    Err(e) => { println!("import_kube_contexts: read_dir error: {}", e); return Ok(0) },
  };

  let crypto: Option<Crypto> = Crypto::init().ok();

  while let Some(entry) = rd.next_entry().await.map_err(|e| e.to_string())? {
    let ft: FileType = entry.file_type().await.map_err(|e| e.to_string())?;
    if !ft.is_file() { continue; }
    let path: PathBuf = entry.path();
    let fname: &str = path.file_name().and_then(|s| s.to_str()).unwrap_or("");
    if !(fname == "config" || fname.ends_with(".yaml") || fname.ends_with(".yml")) { continue; }

    let content: String = match tokio::fs::read_to_string(&path).await { Ok(s) => s, Err(e) => { println!("read_to_string error: {}", e); continue } };
    let raw: KubeConfigRaw = match serde_yaml::from_str(&content) { Ok(v) => v, Err(e) => { println!("serde_yaml parse error: {}", e); continue } };

    let contexts: Vec<KCNamedContext> = match raw.contexts { Some(v) => v, None => { println!("no contexts in {:?}", path); continue } };
    let clusters: Vec<KCNamedCluster> = raw.clusters.unwrap_or_default();
    let users: Vec<KCNamedUser> = raw.users.unwrap_or_default();

    for nc in contexts.iter() {
      let name: String = nc.name.clone();
      if existing.iter().any(|e| e == &name) { continue; }

      let cluster_entry: Option<KCNamedCluster> = clusters.iter().find(|c: &&KCNamedCluster| c.name == nc.context.cluster).cloned();
      let user_entry: Option<KCNamedUser> = nc.context.user.as_ref().and_then(|uname: &String| users.iter().find(|u: &&KCNamedUser| u.name == *uname).cloned());

      let out_ctx = OutNamedContext { name: name.clone(), context: nc.context.clone() };
      let mut out_clusters: Vec<_> = Vec::new();
      if let Some(c) = cluster_entry { out_clusters.push(OutNamedCluster { name: c.name, cluster: c.cluster }); }
      let mut out_users: Vec<_> = Vec::new();
      if let Some(u) = user_entry { out_users.push(OutNamedUser { name: u.name, user: u.user }); }

      let out = KubeConfigOut {
        api_version: "v1".to_string(),
        kind: "Config".to_string(),
        current_context: name.clone(),
        contexts: vec![out_ctx],
        clusters: out_clusters,
        users: out_users,
      };
      let yaml: String = serde_yaml::to_string(&out).map_err(|e: serde_yaml::Error| e.to_string())?;

      if let Some(crypto) = &crypto {
        if let Ok(kc_enc) = crypto.encrypt(yaml.as_bytes()) {
          let kc_b64: String = STANDARD.encode(kc_enc);
          let _ = crypto::secrets_set(&format!("ctx:{}:kubeconfig", name), &kc_b64);
        }
        if let Ok(token_enc) = crypto.encrypt("".as_bytes()) {
          let token_b64: String = STANDARD.encode(token_enc);
          let _ = crypto::secrets_set(&format!("ctx:{}:token", name), &token_b64);
        }
      }

      sqlx::query("INSERT OR IGNORE INTO contexts(name, cluster, user, namespace) VALUES(?, ?, ?, ?)")
        .bind(&name)
        .bind(Some(nc.context.cluster.clone()))
        .bind(nc.context.user.clone())
        .bind(nc.context.namespace.clone())
        .execute(&state.db)
        .await
        .map_err(|e: sqlx::Error| e.to_string())?;

      imported += 1;
    }
  }

  Ok(imported)
}
