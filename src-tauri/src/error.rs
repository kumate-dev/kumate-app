//! Typed error handling for the whole backend.
//!
//! Every `#[tauri::command]` should return `Result<T, AppError>` rather than
//! `Result<T, String>`. `AppError` serializes to a stable, structured JSON shape
//! so the frontend can branch on `kind` / `code` instead of pattern-matching on
//! human-readable prose:
//!
//! ```json
//! { "kind": "api", "code": 404, "reason": "NotFound", "message": "pods \"web\" not found" }
//! ```
//!
//! `src/types/error.ts` mirrors this shape and `src/utils/error.ts` knows how to
//! render it, including the legacy plain-string form still produced by any
//! command that has not been migrated yet.

use serde::ser::{Serialize, SerializeStruct, Serializer};

/// The machine-readable discriminator carried in the `kind` field.
///
/// Keep these strings in sync with `AppErrorKind` in `src/types/error.ts`.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ErrorKind {
    Disconnected,
    Api,
    Kubeconfig,
    Timeout,
    NotFound,
    Invalid,
    Serde,
    Io,
    Internal,
}

impl ErrorKind {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Disconnected => "disconnected",
            Self::Api => "api",
            Self::Kubeconfig => "kubeconfig",
            Self::Timeout => "timeout",
            Self::NotFound => "not_found",
            Self::Invalid => "invalid",
            Self::Serde => "serde",
            Self::Io => "io",
            Self::Internal => "internal",
        }
    }
}

#[derive(Debug, thiserror::Error)]
pub enum AppError {
    /// The user explicitly disconnected this cluster; all API access is gated off.
    #[error("cluster '{context}' is disconnected")]
    Disconnected { context: String },

    /// The apiserver returned a structured `Status` error.
    #[error("{message}")]
    Api {
        code: u16,
        reason: String,
        message: String,
    },

    /// The stored kubeconfig for a context could not be parsed or turned into a client.
    ///
    /// The `message` is deliberately scrubbed by [`redact`] before it reaches this
    /// variant, because kubeconfig parse errors routinely quote the offending
    /// input — which may be `client-key-data` or a bearer token.
    #[error("kubeconfig for context '{context}' is unusable: {message}")]
    Kubeconfig { context: String, message: String },

    #[error("operation timed out after {seconds}s")]
    Timeout { seconds: u64 },

    #[error("{0}")]
    NotFound(String),

    #[error("invalid input: {0}")]
    Invalid(String),

    #[error("serialization failed: {0}")]
    Serde(String),

    #[error("io error: {0}")]
    Io(String),

    #[error("{0}")]
    Internal(String),
}

impl AppError {
    pub fn kind(&self) -> ErrorKind {
        match self {
            Self::Disconnected { .. } => ErrorKind::Disconnected,
            Self::Api { .. } => ErrorKind::Api,
            Self::Kubeconfig { .. } => ErrorKind::Kubeconfig,
            Self::Timeout { .. } => ErrorKind::Timeout,
            Self::NotFound(_) => ErrorKind::NotFound,
            Self::Invalid(_) => ErrorKind::Invalid,
            Self::Serde(_) => ErrorKind::Serde,
            Self::Io(_) => ErrorKind::Io,
            Self::Internal(_) => ErrorKind::Internal,
        }
    }

    /// HTTP-ish status code when one is known. `0` means "not applicable".
    pub fn code(&self) -> u16 {
        match self {
            Self::Api { code, .. } => *code,
            Self::NotFound(_) => 404,
            Self::Invalid(_) => 400,
            Self::Timeout { .. } => 504,
            Self::Disconnected { .. } => 503,
            _ => 0,
        }
    }

    /// Kubernetes `Status.reason`, or a stable stand-in.
    pub fn reason(&self) -> &str {
        match self {
            Self::Api { reason, .. } => reason,
            other => other.kind().as_str(),
        }
    }

    pub fn internal(msg: impl std::fmt::Display) -> Self {
        Self::Internal(msg.to_string())
    }

    pub fn invalid(msg: impl std::fmt::Display) -> Self {
        Self::Invalid(msg.to_string())
    }

    /// True when retrying the same call has a realistic chance of succeeding.
    pub fn is_retryable(&self) -> bool {
        match self {
            Self::Timeout { .. } => true,
            Self::Api { code, .. } => matches!(code, 429 | 500 | 502 | 503 | 504),
            _ => false,
        }
    }

    /// Build an `AppError` from a `kube::Error`, preserving the apiserver `Status`
    /// fields when present and attaching the resource name for context.
    pub fn from_kube(e: &kube::Error, resource: &str) -> Self {
        match e {
            // kube 3 merged `ErrorResponse` into `kube::core::Status` and boxed it, so
            // this binds `&Box<Status>` rather than `&ErrorResponse`. The three fields we
            // read kept both their names and their types (`code: u16`, `message: String`,
            // `reason: String` — kube's own `Status`, *not* k8s-openapi's, whose fields are
            // all `Option`), and field access auto-derefs through the `Box`, so the body
            // below is unchanged. If you ever need to branch on the class of failure,
            // prefer the new `ae.is_not_found()` / `ae.is_forbidden()` helpers over `code`.
            kube::Error::Api(ae) => {
                let message = if ae.message.is_empty() {
                    format!("{}: {}", ae.reason, resource)
                } else {
                    ae.message.clone()
                };
                Self::Api {
                    code: ae.code,
                    reason: ae.reason.clone(),
                    message,
                }
            }
            other => Self::Internal(format!("{}: {}", resource, redact(&other.to_string()))),
        }
    }
}

/// Strip anything that looks like embedded credential material out of a message
/// before it is logged or sent to the frontend.
///
/// This is intentionally blunt: kubeconfig and TLS parse errors quote their input,
/// and we would rather lose diagnostic detail than leak a client key. Matching is
/// line-oriented so a multi-line YAML error only loses the offending lines.
pub fn redact(msg: &str) -> String {
    const SENSITIVE: [&str; 8] = [
        "client-key-data",
        "client-certificate-data",
        "certificate-authority-data",
        "token",
        "password",
        "BEGIN RSA PRIVATE KEY",
        "BEGIN PRIVATE KEY",
        "BEGIN EC PRIVATE KEY",
    ];

    msg.lines()
        .map(|line| {
            let lower = line.to_ascii_lowercase();
            if SENSITIVE
                .iter()
                .any(|needle| lower.contains(&needle.to_ascii_lowercase()))
            {
                "[redacted]"
            } else {
                line
            }
        })
        .collect::<Vec<_>>()
        .join("\n")
}

/// Serialize to a structured object. Tauri passes this straight through to the
/// frontend as the rejection value of `invoke()`.
impl Serialize for AppError {
    fn serialize<S: Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        let mut s = serializer.serialize_struct("AppError", 5)?;
        s.serialize_field("kind", self.kind().as_str())?;
        s.serialize_field("code", &self.code())?;
        s.serialize_field("reason", self.reason())?;
        s.serialize_field("message", &self.to_string())?;
        s.serialize_field("retryable", &self.is_retryable())?;
        s.end()
    }
}

impl From<serde_json::Error> for AppError {
    fn from(e: serde_json::Error) -> Self {
        Self::Serde(e.to_string())
    }
}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        Self::Io(e.to_string())
    }
}

impl From<kube::Error> for AppError {
    fn from(e: kube::Error) -> Self {
        Self::from_kube(&e, "request")
    }
}

impl From<anyhow::Error> for AppError {
    fn from(e: anyhow::Error) -> Self {
        Self::Internal(redact(&e.to_string()))
    }
}

// serde_yaml is gone; serde-saphyr splits YAML failures across two unrelated types.
// `serde_saphyr::Error` (aliased by the crate as `DeserializeError`) and
// `serde_saphyr::SerializeError` are distinct, so `?` needs a `From` for each — a single
// impl would only cover one direction and the other call site would fail to compile.
//
// Both stay routed through `redact()`: saphyr's deserialize errors quote the offending
// input with a source snippet, and the input here is a decrypted kubeconfig.
impl From<serde_saphyr::Error> for AppError {
    fn from(e: serde_saphyr::Error) -> Self {
        Self::Serde(redact(&e.to_string()))
    }
}

impl From<serde_saphyr::SerializeError> for AppError {
    fn from(e: serde_saphyr::SerializeError) -> Self {
        Self::Serde(redact(&e.to_string()))
    }
}

/// Bridge for the command surface that still returns `Result<T, String>`.
/// Remove once every command has been migrated to `AppResult`.
impl From<AppError> for String {
    fn from(e: AppError) -> Self {
        e.to_string()
    }
}

pub type AppResult<T> = Result<T, AppError>;
