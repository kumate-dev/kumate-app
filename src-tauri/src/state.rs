use std::path::PathBuf;

use crate::databases::{k8s_contexts::K8sContextsRepo, Database};
use anyhow::Result;

#[derive(Clone)]
pub struct AppState {
    pub k8s_contexts: K8sContextsRepo,
}

impl AppState {
    pub async fn init(data_dir: PathBuf) -> Result<Self> {
        let db: Database = Database::init(data_dir).await?;
        let k8s_contexts: K8sContextsRepo = K8sContextsRepo::new(&db.db)?;
        Ok(Self { k8s_contexts })
    }
}
