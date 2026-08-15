use anyhow::Result;
use std::path::PathBuf;

use sled::Db;

pub mod k8s_contexts;

#[derive(Clone)]
pub struct Database {
    pub db: Db,
}

impl Database {
    pub async fn init(data_dir: PathBuf) -> Result<Self> {
        let db_path: PathBuf = data_dir.join("db");
        if let Some(parent) = db_path.parent() {
            tokio::fs::create_dir_all(parent).await?;
        }

        let db: Db = sled::open(db_path)?;

        Ok(Self { db })
    }
}
