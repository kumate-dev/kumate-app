//! At-rest encryption for stored kubeconfigs.
//!
//! # Threat model — read this before relying on it
//!
//! The data key lives in `APP_KEY_PATH`, in the same directory tree as the
//! ciphertexts it protects. Anything that can read `secrets/*.txt` can also read
//! `kumate.key`. This is therefore **obfuscation against casual inspection and
//! against backup/sync tools that slurp plaintext config files** — it is *not*
//! protection against a local attacker or malware running as the user.
//!
//! Real protection requires an OS-held key (macOS Keychain, Windows DPAPI,
//! Secret Service on Linux). That is tracked as follow-up work in
//! `.claude/rust.md`; moving the key there is the single highest-value
//! improvement to this module and needs a migration path for existing installs.
//!
//! What this module *does* guarantee: files are created mode 0600 in a mode 0700
//! directory, so other local users cannot read them, and the key is loaded once
//! per process rather than re-read and re-parsed on every Kubernetes request.

use anyhow::{anyhow, Result};
use base64::{engine::general_purpose::STANDARD, Engine};
// rand 0.10 renamed the core trait `RngCore` -> `Rng` (the old `Rng` extension trait is
// now `RngExt`), and `thread_rng()` -> `rng()`. `fill_bytes` is a required method of the
// core trait, so `Rng` — not `RngExt` — is the import this file needs.
use rand::Rng;
use ring::aead::{self, Aad, LessSafeKey, Nonce, UnboundKey, NONCE_LEN};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use crate::constants::app::{APP_KEY_PATH, APP_SECRETS_DIR};

/// ChaCha20-Poly1305 authentication tag length.
const TAG_LEN: usize = 16;

/// Guard against absurd filenames; most filesystems cap a component at 255 bytes
/// and we append `.txt`.
const MAX_NAME_LEN: usize = 200;

pub struct Crypto {
    key: &'static LessSafeKey,
}

impl Crypto {
    /// Load (or create) the data key.
    ///
    /// The key is cached for the process lifetime. Previously every call re-read and
    /// base64-decoded the key file, and `K8sClient::for_context` called this on
    /// *every* Kubernetes request — so a single page of pods meant hundreds of
    /// redundant file reads.
    pub fn init() -> Result<Self> {
        static KEY: OnceLock<LessSafeKey> = OnceLock::new();

        if let Some(key) = KEY.get() {
            return Ok(Self { key });
        }

        let key_bytes = Self::load_or_create_key()?;
        let unbound = UnboundKey::new(&aead::CHACHA20_POLY1305, &key_bytes)
            .map_err(|_| anyhow!("invalid data key"))?;

        // Racing callers are fine: whoever loses simply uses the winner's key,
        // which was derived from the same file.
        let key = KEY.get_or_init(|| LessSafeKey::new(unbound));
        Ok(Self { key })
    }

    fn load_or_create_key() -> Result<Vec<u8>> {
        Self::ensure_dir(&APP_SECRETS_DIR)?;

        if APP_KEY_PATH.exists() {
            let s = fs::read_to_string(&*APP_KEY_PATH)?;
            // Re-assert permissions on every start: an older build created this
            // file with the default umask (0644 on most systems).
            harden(&APP_KEY_PATH, 0o600);
            return STANDARD.decode(s.trim()).map_err(|e| anyhow!(e));
        }

        let mut kb = [0u8; 32];
        rand::rng().fill_bytes(&mut kb);
        fs::write(&*APP_KEY_PATH, STANDARD.encode(kb))?;
        harden(&APP_KEY_PATH, 0o600);
        Ok(kb.to_vec())
    }

    /// Encrypt to `nonce || ciphertext || tag`.
    pub fn encrypt(&self, plaintext: &[u8]) -> Result<Vec<u8>> {
        let mut nonce_bytes = [0u8; NONCE_LEN];
        rand::rng().fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::assume_unique_for_key(nonce_bytes);

        // `seal_in_place_append_tag` appends the tag itself. The previous
        // implementation *also* pre-appended 16 zero bytes, so every stored
        // kubeconfig had 16 NULs encrypted into its plaintext. It only ever worked
        // because `K8sClient::sanitize_yaml` filters control characters back out.
        // That filter must stay for as long as pre-fix ciphertexts exist on disk.
        let mut in_out = plaintext.to_vec();
        self.key
            .seal_in_place_append_tag(nonce, Aad::empty(), &mut in_out)
            .map_err(|_| anyhow!("encrypt failed"))?;

        let mut out = Vec::with_capacity(NONCE_LEN + in_out.len());
        out.extend_from_slice(&nonce_bytes);
        out.extend_from_slice(&in_out);
        Ok(out)
    }

    pub fn decrypt(&self, data: &[u8]) -> Result<Vec<u8>> {
        if data.len() < NONCE_LEN + TAG_LEN {
            return Err(anyhow!("ciphertext too short"));
        }

        let (nonce_bytes, cipher) = data.split_at(NONCE_LEN);
        let nonce =
            Nonce::assume_unique_for_key(nonce_bytes.try_into().map_err(|_| anyhow!("bad nonce"))?);

        let mut in_out = cipher.to_vec();
        // NOTE: `Aad::empty()` means ciphertexts are not bound to the name they are
        // stored under, so a local attacker who can write the secrets directory
        // could swap one context's kubeconfig for another's. Binding the AAD to the
        // secret name is the correct fix but requires a read-old/write-new migration
        // for existing installs; see `.claude/rust.md`.
        let plain = self
            .key
            .open_in_place(nonce, Aad::empty(), &mut in_out)
            .map_err(|_| anyhow!("decrypt failed"))?;

        Ok(plain.to_vec())
    }

    pub fn secrets_set(&self, name: &str, cipher_b64: &str) -> Result<()> {
        let p = self.secret_path(name)?;
        if let Some(parent) = p.parent() {
            Self::ensure_dir(parent)?;
        }
        fs::write(&p, cipher_b64)?;
        harden(&p, 0o600);
        Ok(())
    }

    pub fn secrets_get(&self, name: &str) -> Result<String> {
        let p = self.secret_path(name)?;
        Ok(fs::read_to_string(p)?.trim().to_string())
    }

    // pub fn secrets_delete(&self, name: &str) -> Result<()> {
    //     let p = self.secret_path(name)?;
    //     if p.exists() {
    //         fs::remove_file(p)?;
    //     }
    //     Ok(())
    // }

    fn ensure_dir(p: &Path) -> Result<()> {
        fs::create_dir_all(p)?;
        harden(p, 0o700);
        Ok(())
    }

    /// Resolve the on-disk path for a secret, refusing anything that would land
    /// outside the secrets directory.
    ///
    /// `sanitize_name` already maps `/`, `\` and `:` away, so `..` on its own cannot
    /// traverse. The containment check below is a belt-and-braces assertion: it makes
    /// the invariant explicit and will catch any future loosening of the character
    /// filter, rather than leaving it as an implicit consequence of two separate
    /// pieces of code agreeing with each other.
    fn secret_path(&self, name: &str) -> Result<PathBuf> {
        let sanitized = Self::sanitize_name(name);
        if sanitized.is_empty() {
            return Err(anyhow!("secret name is empty after sanitization"));
        }

        let path = APP_SECRETS_DIR.join(format!("{sanitized}.txt"));
        if path.parent() != Some(APP_SECRETS_DIR.as_path()) {
            return Err(anyhow!(
                "refusing to write secret outside the secrets directory"
            ));
        }

        Ok(path)
    }

    /// Map path-significant characters to `_`.
    ///
    /// The exact mapping is load-bearing: it determines the filename of every
    /// already-stored kubeconfig. Do not tighten it without a migration, or existing
    /// installs will silently lose their saved contexts.
    fn sanitize_name(name: &str) -> String {
        name.chars()
            .take(MAX_NAME_LEN)
            .map(|c| match c {
                '/' | ':' | '\\' => '_',
                c if c.is_control() => '_',
                c => c,
            })
            .collect()
    }
}

/// Best-effort permission tightening. Failure is non-fatal — on Windows we rely on
/// ACL inheritance from the per-user AppData directory.
#[cfg(unix)]
pub fn harden(path: &Path, mode: u32) {
    use std::os::unix::fs::PermissionsExt;
    let _ = fs::set_permissions(path, fs::Permissions::from_mode(mode));
}

#[cfg(not(unix))]
pub fn harden(_path: &Path, _mode: u32) {}
