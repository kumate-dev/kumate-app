use dirs::{data_dir, home_dir};
use once_cell::sync::Lazy;
use std::path::PathBuf;

pub const APP_NAME: &str = "Kumate";

pub static APP_DATA_DIR: Lazy<PathBuf> = Lazy::new(|| {
    data_dir()
        .unwrap_or_else(|| home_dir().unwrap_or_else(|| PathBuf::from(".")))
        .join(APP_NAME)
});

pub static APP_SECRETS_DIR: Lazy<PathBuf> = Lazy::new(|| APP_DATA_DIR.join("secrets"));
pub static APP_KEY_PATH: Lazy<PathBuf> = Lazy::new(|| APP_DATA_DIR.join("kumate.key"));

/// Private scratch directory for short-lived files that may contain credential
/// material (kubeconfig copies, Helm values). Deliberately *not* the system temp
/// dir, which is world-readable on Unix. Created mode 0700 on first use and its
/// contents are removed on startup and immediately after each use.
pub static APP_TMP_DIR: Lazy<PathBuf> = Lazy::new(|| APP_DATA_DIR.join("tmp"));
