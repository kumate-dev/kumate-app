# Rust conventions

## Error handling

One error type: `AppError` in `src/error.rs`, built with `thiserror`. Every command
returns `AppResult<T>`.

It serializes to a structured object rather than a string:

```json
{
  "kind": "api",
  "code": 404,
  "reason": "NotFound",
  "message": "pods \"web\" not found",
  "retryable": false
}
```

`kind` is the stable machine-readable discriminator; keep it in sync with
`src/types/error.ts`. The frontend branches on `kind`/`code` (see
`src/utils/error.ts`: `isNotFound`, `isForbidden`, `isDisconnected`, `isRetryable`).
Before this, all 213 commands returned `Result<T, String>` and the UI could only
pattern-match on prose.

Use `AppError::from_kube(&e, name)` for `kube::Error` — it preserves the apiserver
`Status` code and reason. `From` impls exist for `serde_json`, `serde_yaml`,
`std::io` and `anyhow`, so `?` works.

`From<AppError> for String` exists as a migration bridge for the handful of commands
still declaring `Result<T, String>`. Note the trap that bit three files: `?` applies
the conversion, **a tail expression does not**. If you change a manager method to
`AppResult`, every caller returning `Result<_, String>` in tail position needs an
explicit `.map_err(|e| e.to_string())`.

## No panics

`unwrap()`, `expect()`, `panic!`, `todo!`, `unreachable!` are banned in anything
reachable from a command. A panic inside an async command aborts the task; the
frontend's promise never settles and the UI hangs with no error.

`unwrap_or`, `unwrap_or_default`, `unwrap_or_else` are fine — they don't panic.

Current count in `src-tauri/src`: **0**. Keep it there. Slice indexing counts as a
panic site unless the length is checked immediately above it.

`serde_json::to_value(&x).unwrap_or(Value::Null)` is not an acceptable workaround.
It pushes a null row into the UI and makes the failure undiagnosable. Propagate with
`?`, or log and skip the item.

## Logging

`tracing` only. `println!`/`eprintln!` are banned: in a bundled macOS `.app` they go
to the system log with no level filtering and no way to turn them off — and two of
them were leaking credential-adjacent material.

Structured fields, not interpolated prose:

```rust
tracing::warn!(context = %name, error = %redact(&e.to_string()), "watch error");
```

**Any message derived from an error must go through `error::redact()`** before being
logged or returned. kubeconfig and TLS parse errors quote their input, which may be
`client-key-data` or a bearer token. `redact` is line-oriented, so a multi-line YAML
error only loses the offending lines.

Never Debug-print a `Command`: that dumps the whole argv, including
`--kube-context` and `-f <values-file>`.

## Concurrency

- `RwLock` for read-mostly state (`ConnectionsManager` is read once per API call —
  it was a `Mutex`, which serialized every Kubernetes request in the process).
- `Mutex` only where writes dominate.
- Never hold a lock guard across an `.await` unless you have reasoned about it and
  written down why. Tauri command futures must stay `Send`.
- Every spawned task takes a `CancellationToken` and polls it. If you cannot cancel
  it, do not spawn it — drive the future from a task a manager holds a handle to.
  Prefer `join_all` over N spawns: it keeps cancellation in one place.
- `select!` branches must be cancel-safe. Say so in a comment when it is not obvious.

## Security

- Credentials live encrypted under `<data_dir>/Kumate/secrets/`, mode 0600, in a
  0700 directory.
- Short-lived plaintext (decrypted kubeconfigs, Helm values) goes in
  `APP_TMP_DIR` — **never** `std::env::temp_dir()`, which is world-readable on Unix.
  Use a `Drop` guard so it is removed on every exit path including unwinding.
  `lib.rs` sweeps the directory on startup to cover SIGKILL.
- Never interpolate a frontend-supplied string into a path without sanitizing it.
- Never mutate process-global env vars (`PATH`, `KUBECONFIG`) from request handlers.
  The old client builder set `KUBECONFIG`, built a client, and restored it — a data
  race between concurrent commands. `PATH` is now extended exactly once per process
  behind a `OnceLock`.

### Known limitations

**The data key is stored next to the ciphertext it protects.** Anything that can read
`secrets/*.txt` can read `kumate.key`. This is obfuscation against casual inspection
and against backup tools that slurp plaintext config, not protection against local
malware.

_Fix:_ hold the key in the OS keychain (macOS Keychain, Windows DPAPI, Secret Service)
with a read-old/write-new migration for existing installs. Highest-value security work
remaining.

**Ciphertexts are not bound to their names.** `Aad::empty()` means an attacker who can
write the secrets directory could swap one context's kubeconfig for another's.

_Fix:_ bind the AAD to the secret name. Also needs a migration.

**`Crypto::encrypt` used to append 16 NUL bytes** to every plaintext before sealing
(on top of the tag the AEAD appends itself). Fixed, but pre-fix ciphertexts on disk
still decrypt with trailing NULs, which is why `K8sClient::sanitize_yaml` filters
control characters. **That filter must stay** until those ciphertexts are gone.

**Deleting a context does not delete its stored credentials.** There is currently no
delete-context command, so nothing leaks in practice; wire `Crypto::secrets_delete`
in when one is added.

## Dependencies

Justify every addition. `reqwest` was declared and never imported, duplicating the
TLS backend kube already brings.

Declare tokio features explicitly rather than relying on transitive activation — it
breaks silently the moment a dependency drops one.

### Pinned on purpose — do NOT "update" these

- **`bincode` stays at 2.** 3.0.0 is a _tombstone_: the crate contains only a README
  and a `compile_error!`, because upstream development stopped. Bumping breaks the
  build outright. The community continuation is the separately-published
  `bincode-next` if fixes are ever needed.
- **`sled` stays at 0.34.7.** It is the newest stable; 1.0 has been in alpha since
  2024-10 and is dormant. A long-term migration risk for `databases/`, but there is
  nothing to move to.

### Coupled — bump together or not at all

- **`kube` ↔ `k8s-openapi`**: kube 2.x needs 0.26, 3.x needs 0.27, 4.x needs ^0.28. A
  mismatch produces a wall of trait errors from two k8s-openapi copies in the tree.
- **Exactly one `v1_*` feature** of k8s-openapi may be active across the whole graph.
- **kube's crypto provider is explicit.** With `default-features = false`, kube enables
  no provider, while our direct `rustls` dependency picks aws-lc-rs. The mismatch shows
  up at _runtime_ as a missing default provider, not at compile time — which is why
  `aws-lc-rs` is in kube's feature list. Check with
  `cargo tree -e features -i rustls` after touching that block.

### Replaced

`serde_yaml` is dead — its final release is literally `0.9.34+deprecated` and the repo
is archived. We use **`serde-saphyr`**, the parser kube itself migrated to. It has no
`Value` type, so untyped YAML nodes are `serde_json::Value`; one visible consequence is
that emitted map keys are now alphabetical (`serde_json::Map` is a `BTreeMap`), which is
cosmetic but shows up in diffs of generated kubeconfigs.

`chrono` is gone with k8s-openapi 0.27, which moved `meta::v1::Time` to **`jiff`** and
dropped the re-export. `jiff::Timestamp`'s `Display` is plain RFC 3339 with `Z` and no
RFC 9557 `[UTC]` annotation — that matters, because a bracketed suffix would be stored
verbatim in the `kumate.dev/restartedAt` annotation.
