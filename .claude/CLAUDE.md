# Kumate — development guide

A Kubernetes desktop manager (Lens-class) built on Tauri v2 + Rust + TypeScript.
Priorities, in order:

**Performance → Architecture → Maintainability → UX → Features**

Every design decision in this repo should be justifiable against that ordering. If an
abstraction cannot be defended, it does not belong here.

## Specialised guides

| File              | Covers                                                 |
| ----------------- | ------------------------------------------------------ |
| `architecture.md` | System layers, data flow, module map                   |
| `kubernetes.md`   | Client, watchers, cache, event protocol                |
| `rust.md`         | Rust conventions, error handling, logging, security    |
| `tauri.md`        | IPC, commands, capabilities, permissions, windows      |
| `performance.md`  | Performance rules and the known bottlenecks            |
| `frontend.md`     | Frontend conventions and the React → SolidJS migration |

## Repo layout

```
src/                  frontend (TypeScript)
src-tauri/            backend (Rust)
  capabilities/       Tauri permission grants
  src/
    commands/         #[tauri::command] surface — the IPC boundary
    manager/k8s/      Kubernetes domain logic
    databases/        sled persistence
    utils/            watcher / exec / port-forward / crypto managers
    error.rs          AppError — the one error type
    state.rs          state layout and the rationale for the globals
```

## Commands

Package manager is **bun**. Do not switch it.

```bash
bun install
bun run tauri dev        # run the app
bun run build            # vite build (also runs before tauri dev/build)
bun run tsc              # typecheck, no emit
bun run lint             # eslint
bun run format           # prettier + cargo fmt

cargo check  --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml
cargo test   --manifest-path src-tauri/Cargo.toml
bun run tauri build      # bundle
```

`KUMATE_LOG` controls backend log level (`RUST_LOG` syntax), default
`warn,kumate_lib=info`. `KUMATE_DATA_DIR` overrides the data directory, which is how
you run two instances side by side without fighting over the sled lock.

## Non-negotiables

These are the rules that real bugs in this codebase were caused by breaking.

1. **Never poll the Kubernetes API on a timer.** Watch, cache, emit deltas. See
   `kubernetes.md`.
2. **Never `unwrap`/`expect`/`panic!` in backend code reachable from a command.** A
   panic in an async command aborts the task and the UI hangs with no error.
3. **Every command returns `AppResult<T>`** (`Result<T, AppError>`), never
   `Result<T, String>`. Stringly-typed errors cannot be branched on.
4. **Never log a message derived from a kubeconfig, a Secret, or a process argv
   without `error::redact()`.** Two real leaks came from exactly this.
5. **Never spawn a task nothing can cancel.** Take a `CancellationToken`, or drive
   the future from a task whose handle a manager holds.
6. **Never render an unbounded Kubernetes list without virtualization.** Pods, Events
   and Logs are routinely in the thousands.
7. **Do not widen Tauri capabilities to make something work.** Move the operation
   into a Rust command instead. See `tauri.md`.
8. **Do not add a dependency that duplicates Rust, Tauri, the browser, or Solid.**
   The frontend shipped 7 dependencies with zero imports; the backend shipped a
   second HTTP stack it never called.

## Conventions

- Comments explain **why**, never what. If a line needs a "what" comment, rename
  things instead. Every non-obvious decision — especially a workaround or a
  deliberate omission — gets a comment saying what breaks without it.
- Doc comments (`//!` per module, `///` per public item) are expected on anything in
  `manager/`, `utils/` or `error.rs`.
- Code and comments are written in English.
- `rustfmt` and `prettier` settle all formatting arguments. `max_width = 100`.
- A "KNOWN ISSUE" / "FOLLOW-UP" comment beside the code beats a tracker entry nobody
  reads — but it must name the fix, not just the problem.

## Context discipline

Be selective about what you read.

- Read only files relevant to the current task.
- Prefer targeted search over reading entire directories.
- Do not repeatedly reread files already understood.
- Do not inspect generated files, build output, lockfiles, or dependencies unless relevant.
- Do not explain obvious implementation details in the final response.
- Keep final responses concise.
