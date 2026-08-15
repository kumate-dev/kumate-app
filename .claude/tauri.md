# Tauri conventions

Tauri **v2** (2.9.x). `main.rs` is a 6-line shim; everything lives in `lib.rs`
(`kumate_lib`) so the mobile entry point and desktop share a path.

## Startup order

`init_tracing` → rustls provider → `purge_scratch_dir` → **single-instance plugin**
→ `setup` (opens sled) → managed state → plugins → `invoke_handler`.

The single-instance plugin must be registered first, or a second launch fights over
the sled lock. `setup` propagates database failure via `?` instead of
`expect("init db")`: a stale sled lock is routine after a kill, and it used to abort
the process with a raw panic and no window.

## Commands

- Return `AppResult<T>`. Both `T` and the error must be `Serialize`.
- Argument names are the wire contract. `name` is the **context** name and
  `resource_name(s)` is the Kubernetes object name. That is confusing, and it is
  preserved deliberately: renaming it touches all 42 files in `src/api/k8s/`.
- `#[tauri::command]` works inside `macro_rules!`, which is how the ~215 per-resource
  commands are generated from `commands/macros.rs`. If you ever see
  `cannot find macro __cmd__<name> in module <mod>`, that is the macro-hygiene
  interaction with tauri's generated `__cmd__` re-export failing; the escape hatch is
  to write the affected commands out longhand.
- Every generated name must be listed in `generate_handler!`. The list is long and
  unavoidable; keep the `//!` header in each `commands/<kind>.rs` naming the commands
  it generates so `generate_handler!` entries stay greppable.

## Capabilities — least privilege

`capabilities/default.json`. Add the narrowest permission that works, and if nothing
narrow enough exists, **move the operation into a Rust command** rather than widening
the grant.

The webview previously held `fs:default` + `fs:scope-home`: read and write across the
entire home directory, including `~/.kube/config`, `~/.aws/credentials` and `~/.ssh`.
Any injected script could have read every credential on the machine. Combined with
the missing CSP, that was the most serious issue in the codebase.

It now holds `fs:allow-read-file` + `fs:allow-write-text-file` scoped to
Download/Document/Desktop/Pictures. No dotfile in `$HOME` is reachable.

**Known limitation:** picking a file outside those directories now fails, because the
dialog plugin does not extend fs scope at runtime in Tauri v2.

**FOLLOW-UP (do this):** the frontend needs exactly two filesystem operations — read
one image for the cluster avatar (`ModalEditContext.tsx`) and write one text file for
saved pod logs (`useViewPodLogs.ts`). Move both into Rust commands that take the path
the dialog returned. That removes all ambient filesystem authority from the webview
_and_ removes the limitation above.

No `shell` plugin is granted. Note that `manager/k8s/helm.rs` shells out to the `helm`
binary from Rust, which bypasses the ACL entirely — that is intentional but means the
Helm code path deserves extra scrutiny.

## CSP

Set in `tauri.conf.json` under `app.security.csp`. There was previously **no CSP at
all**. `script-src 'self'` with no `unsafe-inline` and no `unsafe-eval`;
`style-src` keeps `unsafe-inline` because inline styles are still in use.
`connect-src` allows only `ipc:`. If you need to relax this, relax the narrowest
directive and write down why.

## Events

One channel per watch, named by `build_event_name`. Payloads are
`{ type, object }` — see `kubernetes.md`. Do not invent a second payload shape:
there were four incompatible ones (resources, logs, exec, port-forward) and that is
already one too many.

Streaming output must be **batched**, not per-line. Pod logs emit `LOG_LINES` with an
array, flushed at 64 lines or 100 ms, whichever comes first. One IPC message per log
line floods the channel on a chatty pod.
