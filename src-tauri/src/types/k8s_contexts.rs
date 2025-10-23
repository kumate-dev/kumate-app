use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct K8sContext {
    pub id: String,
    pub name: String,
    pub cluster: Option<String>,
    pub user: Option<String>,
    pub avatar: Option<Vec<u8>>,
    pub created_at: i64,
}
