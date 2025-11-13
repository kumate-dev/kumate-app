use crate::types::k8s_contexts::K8sContext;
use anyhow::Result;
use bincode::config;
use bincode::serde::{decode_from_slice, encode_to_vec};
use sled::{Db, Tree};

#[derive(Clone)]
pub struct K8sContextsRepo {
    tree: Tree,
}

impl K8sContextsRepo {
    pub fn new(db: &Db) -> Result<Self> {
        let tree: Tree = db.open_tree("k8s_contexts")?;
        Ok(Self { tree })
    }

    pub fn add_context(&self, ctx: &K8sContext) -> Result<()> {
        let key: &[u8] = ctx.name.as_bytes();
        let value: Vec<u8> = encode_to_vec(ctx, config::standard())?;
        self.tree.insert(key, value)?;
        // Ensure data is persisted to disk to avoid confusion during development
        let _ = self.tree.flush();
        Ok(())
    }

    pub fn list_contexts(&self) -> Result<Vec<K8sContext>> {
        let mut contexts: Vec<K8sContext> = Vec::new();
        for result in self.tree.iter() {
            let (_key, value) = result?;
            let ctx = self.decode_ctx(&value)?;
            contexts.push(ctx);
        }
        contexts.sort_by(|a, b| a.name.cmp(&b.name));
        Ok(contexts)
    }

    pub fn _delete_context_by_name(&self, name: &str) -> Result<()> {
        self.tree.remove(name.as_bytes())?;
        Ok(())
    }

    pub fn update_context_fields(
        &self,
        name: &str,
        display_name: Option<String>,
        avatar: Option<Vec<u8>>,
    ) -> Result<K8sContext> {
        let key: &[u8] = name.as_bytes();
        let existing = self.tree.get(key)?;
        let mut ctx: K8sContext = if let Some(val) = existing {
            let current = self.decode_ctx(&val)?;
            current
        } else {
            K8sContext {
                id: name.to_string(),
                name: name.to_string(),
                display_name: None,
                cluster: None,
                user: None,
                avatar: None,
                created_at: 0,
            }
        };

        if let Some(dn) = display_name {
            ctx.display_name = if dn.trim().is_empty() { None } else { Some(dn) };
        }
        if avatar.is_some() {
            ctx.avatar = avatar;
        }

        let value: Vec<u8> = encode_to_vec(&ctx, config::standard())?;
        self.tree.insert(key, value)?;
        // Ensure data is persisted to disk to avoid confusion during development
        let _ = self.tree.flush();
        Ok(ctx)
    }

    // Try to decode the current schema; if it fails, try legacy schema and convert.
    fn decode_ctx(&self, value: &[u8]) -> Result<K8sContext> {
        // Try decoding using the current schema
        let try_current: Result<(K8sContext, usize), _> =
            decode_from_slice(&value, config::standard());
        if let Ok((ctx, _len)) = try_current {
            return Ok(ctx);
        }

        // Fallback: Legacy schema without display_name
        #[derive(serde::Deserialize, serde::Serialize, Clone)]
        struct K8sContextLegacy {
            pub id: String,
            pub name: String,
            pub cluster: Option<String>,
            pub user: Option<String>,
            pub avatar: Option<Vec<u8>>,
            pub created_at: i64,
        }
        let (legacy, _len): (K8sContextLegacy, usize) =
            decode_from_slice(&value, config::standard())?;
        Ok(K8sContext {
            id: legacy.id,
            name: legacy.name,
            display_name: None,
            cluster: legacy.cluster,
            user: legacy.user,
            avatar: legacy.avatar,
            created_at: legacy.created_at,
        })
    }
}
