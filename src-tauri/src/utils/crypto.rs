use anyhow::{anyhow, Result};
use base64::{engine::general_purpose::STANDARD, Engine};
use rand::RngCore;
use ring::aead::{self, Aad, LessSafeKey, Nonce, UnboundKey};
use std::fs;
use std::path::{Path, PathBuf};

use crate::constants::app::{APP_KEY_PATH, APP_SECRETS_DIR};

pub struct Crypto {
    key: LessSafeKey,
}

impl Crypto {
    pub fn init() -> Result<Self> {
        Self::ensure_dir(&*APP_SECRETS_DIR)?;
        let key_bytes = if APP_KEY_PATH.exists() {
            let s = fs::read_to_string(&*APP_KEY_PATH)?;
            STANDARD.decode(s.trim()).map_err(|e| anyhow!(e))?
        } else {
            let mut kb = [0u8; 32];
            rand::thread_rng().fill_bytes(&mut kb);
            fs::write(&*APP_KEY_PATH, STANDARD.encode(&kb))?;
            kb.to_vec()
        };

        let unbound = UnboundKey::new(&aead::CHACHA20_POLY1305, &key_bytes)
            .map_err(|_| anyhow!("invalid key"))?;
        Ok(Self {
            key: LessSafeKey::new(unbound),
        })
    }

    pub fn encrypt(&self, plaintext: &[u8]) -> Result<Vec<u8>> {
        let mut nonce_bytes = [0u8; 12];
        rand::thread_rng().fill_bytes(&mut nonce_bytes);
        let nonce: Nonce = Nonce::assume_unique_for_key(nonce_bytes);

        let mut in_out = plaintext.to_vec();
        in_out.extend_from_slice(&[0u8; 16]);
        self.key
            .seal_in_place_append_tag(nonce, Aad::empty(), &mut in_out)
            .map_err(|_| anyhow!("encrypt failed"))?;

        let mut out = nonce_bytes.to_vec();
        out.extend_from_slice(&in_out);
        Ok(out)
    }

    pub fn decrypt(&self, data: &[u8]) -> Result<Vec<u8>> {
        if data.len() < 12 + 16 {
            return Err(anyhow!("cipher too short"));
        }
        let (nonce_bytes, cipher) = data.split_at(12);
        let nonce =
            Nonce::assume_unique_for_key(nonce_bytes.try_into().map_err(|_| anyhow!("bad nonce"))?);
        let mut in_out = cipher.to_vec();
        let plain = self
            .key
            .open_in_place(nonce, Aad::empty(), &mut in_out)
            .map_err(|_| anyhow!("decrypt failed"))?;
        Ok(plain.to_vec())
    }

    pub fn secrets_set(&self, name: &str, cipher_b64: &str) -> Result<()> {
        let p = self.secret_path(name);
        if let Some(parent) = p.parent() {
            Self::ensure_dir(parent)?;
        }
        fs::write(p, cipher_b64)?;
        Ok(())
    }

    pub fn secrets_get(&self, name: &str) -> Result<String> {
        let p = self.secret_path(name);
        let s = fs::read_to_string(p)?;
        Ok(s.trim().to_string())
    }

    pub fn _secrets_delete(&self, name: &str) -> Result<()> {
        let p = self.secret_path(name);
        if p.exists() {
            fs::remove_file(p)?;
        }
        Ok(())
    }

    fn ensure_dir(p: &Path) -> Result<()> {
        fs::create_dir_all(p)?;
        Ok(())
    }

    fn secret_path(&self, name: &str) -> PathBuf {
        APP_SECRETS_DIR.join(format!("{}.txt", Self::sanitize_name(name)))
    }

    fn sanitize_name(name: &str) -> String {
        name.chars()
            .map(|c| match c {
                '/' | ':' | '\\' => '_',
                _ => c,
            })
            .collect()
    }
}
