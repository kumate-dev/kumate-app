use std::path::PathBuf;

use anyhow::Result;
use sqlx::{
    sqlite::{SqliteConnectOptions, SqlitePoolOptions},
    SqlitePool,
};
use std::str::FromStr;

#[derive(Clone)]
pub struct AppState {
    pub db: SqlitePool,
}

impl AppState {
    pub async fn init(db_path: PathBuf) -> Result<Self> {
        if let Some(parent) = db_path.parent() {
            tokio::fs::create_dir_all(parent).await?;
        }

        let conn_str: String = format!("sqlite://{}", db_path.to_string_lossy());
        let opts: SqliteConnectOptions =
            SqliteConnectOptions::from_str(&conn_str)?.create_if_missing(true);
        let pool: sqlx::Pool<sqlx::Sqlite> = SqlitePoolOptions::new()
            .max_connections(5)
            .connect_with(opts)
            .await?;

        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS contexts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                cluster TEXT,
                user TEXT,
                namespace TEXT
            )
            "#,
        )
        .execute(&pool)
        .await?;

        Ok(Self { db: pool })
    }
}
