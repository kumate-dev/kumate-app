use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct K8sContext {
    pub id: String,
    pub name: String,
    // Optional human-friendly display name (does not affect underlying kube context name)
    pub display_name: Option<String>,
    pub cluster: Option<String>,
    pub user: Option<String>,
    pub avatar: Option<Vec<u8>>,
    pub created_at: i64,
}
