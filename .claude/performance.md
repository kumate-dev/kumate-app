# Performance

Performance is the top priority, ahead of architecture. The targets are fast startup,
low idle CPU, low memory, and a UI that stays responsive on a 5,000-pod cluster.

## Rules

1. **Watch, don't poll.** One apiserver read per watch; everything after is memory.
2. **Cache in Rust, not just in the UI.** `ResourceStore` is authoritative;
   `snapshot_resources` serves a full list with zero apiserver traffic.
3. **Emit deltas, never full lists.** One object per event.
4. **Batch streaming IPC.** Logs and exec output are coalesced (64 lines / 100 ms).
   One message per line is a flood.
5. **Strip what you don't render.** `managedFields` is removed before objects are
   cached or serialized — often half the payload of a Pod.
6. **Virtualize unbounded lists.** Pods, Events, Logs, Nodes.
7. **Cap unbounded buffers.** Logs are capped at 5,000 lines, oldest dropped.
8. **One timer, not one per row.** Never `setInterval` per list item.
9. **Idle means idle.** No work when no cluster is selected and nothing is visible.

## Backend: fixed

- **Client rebuild per request.** `for_context` re-read the key file, decrypted the
  kubeconfig, parsed YAML and renegotiated TLS on _every command and every watch_.
  For exec-auth contexts it could re-invoke the auth plugin. Now cached per context
  with a per-context build lock so cold start does one build, not N.
- **Key file re-read per request.** `Crypto::init` re-read and base64-decoded the key
  on every call. Now loaded once per process.
- **Global `Mutex` on the hot path.** `ConnectionsManager::is_connected` is consulted
  before every API call and was behind a `Mutex`, serializing every Kubernetes
  request in the process. Now an `RwLock`.
- **Leaked watch streams.** Per-namespace watches were `tokio::spawn`ed with no
  handles retained, so `unwatch` aborted only the already-returned parent and the
  streams ran for the life of the process. Now driven with `join_all` from the one
  tracked task and cancelled by a shared token.
- **Redundant connection warming.** `commands/warmup.rs` fires lists whose results are
  discarded, because there was no cache to populate. Now that `ResourceStore` exists,
  this file should be deleted and replaced by simply starting the watches.
- **Log flood.** One IPC event per log line → batched `LOG_LINES`.

## Frontend: known bottlenecks

Measured during the audit; most are fixed structurally by the Solid port rather than
patched in React first. Ordered by impact.

1. **`AgeCell` runs one `setInterval(fn, 1000)` per table row.** 72 files use it, one
   instance per row — a 500-row pod list means 500 timers per second. It already
   writes `el.textContent` through a ref to dodge React re-renders, which is the
   clearest possible signal that the render model is the problem. In Solid this is
   one shared timer signal and a fine-grained text binding.
2. **Zero memoization boundaries.** No `memo()` anywhere in the codebase, so every
   watch event reconciles the whole table — twice, because
   `useOptimisticSortedItems` copies props into state via an effect. The 357
   `useCallback` and 166 `useMemo` calls buy nothing when their consumers aren't
   memoized.
3. **`useFilteredItems`' memo never hits.** `PaneGeneric.tsx` passes an inline
   `['name']` literal as a dependency, so the full filter + sort re-runs on every
   render — every keystroke, every watch event.
4. **No virtualization.** `PaneGeneric` maps the entire filtered list to rows.
5. **O(n) Map rebuild per watch event** in `useListK8sResources` — O(n²) during a
   rollout, when hundreds of events per second arrive.
6. **Selection uses object reference equality** (`selectedItems.includes(item)`).
   Watch events create new object identities, so selected rows silently deselect the
   moment the cluster updates them. Correctness bug _and_ O(n·m) inside the row map.
7. **Unbounded log string concatenation** — fixed; now a capped array + join.
8. **Monolithic bundle.** All 37 pages statically imported in `Home.tsx`, no
   `lazy()`/`Suspense`, no `manualChunks`.
9. **One 5s poll loop** in `PortForwarding.tsx` — the only remaining poller.
10. `Home.tsx` rebuilds a 37-entry page-component map, the hotbar cluster array, and
    runs three base64-encoding IIFEs inline in JSX, on **every render**. The cluster
    array feeds a `useMemo` that allocates a `<canvas>` and measures text.

## How to check

There is no benchmark harness yet. Minimum manual check on a cluster with >1,000 pods:

- idle CPU with a pod list open should be ~0%
- `watch_diagnostics` should show watcher and cached-object counts that stop growing
- scrolling a large list should not drop frames
- switching clusters should not leave watchers behind (watcher count returns to the
  new cluster's own)
