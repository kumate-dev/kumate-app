use anyhow::{anyhow, Result};
use base64::{engine::general_purpose::STANDARD, Engine};
use rand::RngCore;
use ring::aead::{self, Aad, LessSafeKey, Nonce, UnboundKey};
use std::fs;
use std::path::PathBuf;

use crate::constants::app::{APP_KEY_PATH, APP_SECRETS_DIR};


fn ensure_dir(p: &PathBuf) -> Result<()> {
    fs::create_dir_all(p)?;
    Ok(())
}

fn sanitize_name(name: &str) -> String {
    name.chars()
        .map(|c| match c {
            '/' | ':' | '\\' => '_',
            _ => c,
        })
        .collect()
}

fn secret_path(name: &str) -> PathBuf {
    APP_SECRETS_DIR.join(format!("{}.txt", sanitize_name(name)))
}

pub struct Crypto {
    key: LessSafeKey,
}

impl Crypto {
    pub fn init() -> Result<Self> {
        ensure_dir(&*APP_SECRETS_DIR)?;
        let key_path: &PathBuf = &*APP_KEY_PATH;
        let key_bytes: Vec<u8> = if key_path.exists() {
            let s: String = fs::read_to_string(key_path)?;
            let s_trim: &str = s.trim();
            STANDARD
                .decode(s_trim)
                .map_err(|e: base64::DecodeError| anyhow!(e))?
        } else {
            let mut kb: [u8; 32] = [0u8; 32];
            rand::thread_rng().fill_bytes(&mut kb);
            let encoded: String = STANDARD.encode(kb);
            fs::write(key_path, encoded)?;
            kb.to_vec()
        };

        let unbound: UnboundKey = UnboundKey::new(&aead::CHACHA20_POLY1305, &key_bytes)
            .map_err(|_| anyhow!("invalid key"))?;
        Ok(Self {
            key: LessSafeKey::new(unbound),
        })
    }

    pub fn encrypt(&self, plaintext: &[u8]) -> Result<Vec<u8>> {
        let mut nonce_bytes: [u8; 12] = [0u8; 12];
        rand::thread_rng().fill_bytes(&mut nonce_bytes);
        let nonce: Nonce = Nonce::assume_unique_for_key(nonce_bytes);

        let mut in_out: Vec<u8> = plaintext.to_vec();
        in_out.extend_from_slice(&[0u8; 16]);
        self.key
            .seal_in_place_append_tag(nonce, Aad::empty(), &mut in_out)
            .map_err(|_| anyhow!("encrypt failed"))?;

        let mut out: Vec<u8> = nonce_bytes.to_vec();
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
}

pub fn secrets_set(name: &str, cipher_b64: &str) -> Result<()> {
    let p = secret_path(name);
    if let Some(parent) = p.parent() {
        ensure_dir(&parent.to_path_buf())?;
    }
    fs::write(p, cipher_b64)?;
    Ok(())
}

pub fn secrets_get(name: &str) -> Result<String> {
    let p = secret_path(name);
    let s = fs::read_to_string(p)?;
    Ok(s.trim().to_string())
}

pub fn _secrets_delete(name: &str) -> Result<()> {
    let p = secret_path(name);
    if p.exists() {
        fs::remove_file(p)?;
    }
    Ok(())
}
