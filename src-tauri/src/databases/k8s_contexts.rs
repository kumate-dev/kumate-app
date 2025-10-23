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
        Ok(())
    }

    pub fn list_contexts(&self) -> Result<Vec<K8sContext>> {
        let mut contexts: Vec<K8sContext> = Vec::new();
        for result in self.tree.iter() {
            let (_key, value) = result?;
            let (ctx, _len) = decode_from_slice(&value, config::standard())?;
            contexts.push(ctx);
        }
        contexts.sort_by(|a, b| a.name.cmp(&b.name));
        Ok(contexts)
    }

    pub fn _delete_context_by_name(&self, name: &str) -> Result<()> {
        self.tree.remove(name.as_bytes())?;
        Ok(())
    }
}
