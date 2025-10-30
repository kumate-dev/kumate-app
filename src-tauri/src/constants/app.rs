use dirs::{data_dir, home_dir};
use once_cell::sync::Lazy;
use std::path::PathBuf;

pub const APP_NAME: &str = "Kumate";

pub static APP_DATA_DIR: Lazy<PathBuf> = Lazy::new(|| {
    data_dir().unwrap_or_else(|| home_dir().unwrap_or_else(|| PathBuf::from("."))).join(APP_NAME)
});

pub static APP_SECRETS_DIR: Lazy<PathBuf> = Lazy::new(|| APP_DATA_DIR.join("secrets"));
pub static APP_KEY_PATH: Lazy<PathBuf> = Lazy::new(|| APP_DATA_DIR.join("kumate.key"));
