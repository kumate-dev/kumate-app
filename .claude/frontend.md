# Frontend

Current state: **SolidJS 1.9**, 34 resource kinds ported. Four bespoke screens remain
(see Status below).

Solid 2.0 was the original ask, but it is still beta and the ecosystem this app needs
(`@kobalte/core`, `lucide-solid`, `solid-toast`, `@tanstack/solid-virtual`) is stable
on 1.9. Idiomatic 1.9 code is nearly identical to 2.0, so this is a cheap upgrade
later. Revisit when 2.0 is stable.

## Status

**All 34 resource kinds are ported.** `src/features/resources/descriptors/` holds one
file per kind (~11,300 lines of configuration) and `registry.ts` lists them in the order
the sidebar and command palette use. Adding a kind is one file plus one line.

`bun run tsc` and `bun run lint` are clean: 0 errors. The 12 remaining warnings are all
`any` in `src/api/k8s/{customResources,helm,namespaces}.ts`, which is the next thing to
type properly.

**Still un-ported — these four are NOT plain resource lists and need bespoke screens:**

| Screen            | Why the descriptor model does not fit                                                                       |
| ----------------- | ----------------------------------------------------------------------------------------------------------- |
| `overview`        | A dashboard, not a table                                                                                    |
| `helmReleases`    | A release is a projection over storage Secrets; every revision is a separate Secret collapsing onto one row |
| `portForwarding`  | Session state owned by the backend, not cluster objects. Also holds the app's last 5s poll loop             |
| `customResources` | Needs runtime GVK discovery to build a descriptor per CRD                                                   |

`src/_legacy/` has been pruned to just those four plus the shared chrome they depend on
(8,750 lines, down from 21,925). It is excluded from `tsconfig.json` and
`eslint.config.mjs`, and **must be deleted once those four screens are ported.**

Also still open: no metrics (CPU/memory columns need a `metrics.k8s.io` backend command
first), and `ResourceTable` has no per-row action slot — `multi: false` actions are
reachable only from the detail panel header.

## Why this port is much smaller than it looks

- **One real route.** `App.tsx` has a single `/`. Navigation is a `useState<PageKey>`
  in `Home.tsx`. `react-router-dom` can be deleted outright.
- **One zustand store**, in one file (`namespaceStore.ts`). `k8sResourceCache.ts` is
  already a plain module-level `Map` and ports verbatim.
- **Both heavy widgets are framework-agnostic.** `xterm` and `prismjs` are driven
  imperatively against a ref. Zero porting work.
- **Only 3 Radix primitives are actually used** (tabs, tooltip, dialog) out of 14
  installed. `@kobalte/core` has direct equivalents.

## Delete before porting

Seven dependencies with **zero imports**: `@dnd-kit/*` (4 packages), `next-themes`,
`vaul`, `recharts`, `@tanstack/react-table`, `class-variance-authority`, `zod`.
Eleven more Radix packages are installed and unused.

Ten dead modules, including `BottomPortForwarder.tsx` (234 LOC), `ui/tabs.tsx`,
`ui/sidebar.tsx`, `ui/icon.tsx`, `ui/bubble.tsx`, `RelativeAge.tsx` +
`useRelativeAge.ts` (both dead, and both duplicates of the live `AgeCell` logic — three
implementations of ticking relative time, two unused), `ButtonPortForward.tsx`,
`useDefaultNamespace.ts` (dead _and_ duplicated inline in `PaneGeneric`),
`api/k8s/warmup.ts`.

`framer-motion` is imported once, for a pulsing opacity keyframe in `skeleton.tsx`.
Replace with 3 lines of CSS and drop ~120 KB.

## The real work: collapse the boilerplate

37 kinds × 3 layers is ~12,000 LOC of near-identical code:

| Layer          | Files | LOC   |
| -------------- | ----- | ----- |
| `pages/*.tsx`  | 37    | 3,158 |
| `Pane*.tsx`    | 38    | 5,234 |
| `Sidebar*.tsx` | 39    | 6,292 |
| `api/k8s/*.ts` | 42    | 3,470 |

`diff pages/Roles.tsx pages/ClusterRoles.tsx` differs in ~40 of 96 lines; the rest is
copy-paste varying only by type parameter and API function name.

Replace with **one config-driven descriptor per kind**:

```ts
{
  (kind, plural, columns, valueGetters, renderRow, sections, api, template);
}
```

Do this _as part of_ the port, not before and not after. The shared core
(`PaneGeneric`, `RightSidebarGeneric`, `TableHeader`) is genuinely shared already and
is the right seam.

## Writing to the cluster: patch, not update

`ResourceApi` exposes both, and they are not interchangeable.

`update` is `Api::replace` — it sends the **whole** object. Two consequences: the watch
layer strips `managedFields` before we ever see an object, so a replace wipes the
apiserver's field-ownership tracking; and it overwrites concurrent changes to parts of
the object the user never looked at. It is the right primitive for the YAML tab, where
the user has genuinely authored the whole document, and the wrong one everywhere else.

`patch` is a JSON merge patch: it touches only the paths it names, and setting a map
entry to `null` deletes it — so add, edit and delete of a single key are one operation.
Use it for any targeted field edit. Backend side it is generated per kind by
`k8s_patch_command!`, so a kind only gets a write path when it needs one.

The ConfigMap and Secret `data` editors are the reference implementation:

| Operation          | Patch body                                                          |
| ------------------ | ------------------------------------------------------------------- |
| ConfigMap edit/add | `{ data: { key: value } }`                                          |
| ConfigMap delete   | `{ data: { key: null } }`, or `binaryData` when the key lives there |
| Secret edit/add    | `{ stringData: { key: plaintext } }`                                |
| Secret delete      | `{ data: { key: null }, stringData: { key: null } }`                |

**Secrets are written through `stringData`, never by encoding base64 in the client.**
`stringData` is write-only; the apiserver encodes it into `data`. Encoding on our side
would put the plaintext through our own base64 helpers on the way out as well as the way
in, and a bug there corrupts a credential silently — the symptom is a pod that cannot
authenticate hours later, with nothing in the diff to look at.

Two rules that fall out of this, both enforced in `KeyValueTable`:

- **Binary values are read-only.** A ConfigMap `binaryData` entry, or a Secret value
  that is not valid UTF-8, cannot be edited as text without corrupting it.
  `isBinaryBase64` is the test. Deleting such a key is still fine.
- **A Secret value must be revealed before it can be edited.** An edit affordance on a
  masked value is a trap. Values never appear in a toast, a log or an error string.

Never optimistically mutate after a write. The watch delivers `MODIFIED` and the row
updates itself — that is what the reconcile-in-place design in `createResourceList` is
for.

## Solid conventions

- `createSignal` for local state, `createStore` for keyed collections, `createMemo`
  for derived values, `createResource` for async.
- **No React idioms.** `useEffect`-as-derivation, props-copied-into-state, and manual
  memoization all disappear. If you find yourself reaching for an effect to compute a
  value, use a memo.
- Props are getters — never destructure them, or you lose reactivity.
- `<For>` (keyed) and `<Index>` (positional) instead of `.map`. Use `<For>` with a
  stable key for Kubernetes objects: `${namespace}/${name}`, **never** object identity.
- `<Show>` instead of `&&`.
- One shared clock signal for all relative timestamps. Never a timer per row.
- Virtualize with `@tanstack/solid-virtual`.
- Portals via Solid's `<Portal>`, not `createPortal`.

## Fix during the port, not before

- **Selection keyed by `ns/name`, not object identity.** This is a live bug: rows
  deselect whenever the cluster updates them.
- **Virtualization** on every resource table.
- **Route state in the URL** so cluster/namespace/page are shareable and restorable.
- **`lazy()` + `manualChunks`** — 37 pages are statically imported today.
- **Typed errors.** `src/utils/error.ts` now exposes `isNotFound`, `isForbidden`,
  `isDisconnected`, `isRetryable`, `getErrorHint`. Use them instead of matching on
  message text. `disconnected` is a user action, not a failure — it should not toast.
- **`SYNCED` watch events** to end skeleton states, replacing the current trick of
  inferring loaded-ness from the first watch event.
- **`snapshot_resources`** to prime a page from the Rust cache instead of re-`list`ing.

## TypeScript

`strict` is on. 64 `any` occurrences remain, concentrated exactly where they hurt:
`SidebarPods.tsx` (10), `api/k8s/customResources.ts` (9), and `PaneGeneric.tsx` (8) —
including `useFilteredItems<any>`, which erases the generic parameter for the whole
filter path. Kubernetes resource types come from `@kubernetes/client-node`; derive
domain types from those rather than restating them.

Keep `src/types/error.ts` and `src/types/k8sEvent.ts` in sync with
`src-tauri/src/error.rs` and `src-tauri/src/types/event.rs`. Those four files are the
IPC contract.

## Scope discipline

For each task, modify only the files and subsystems required to complete that task.

Do not proactively refactor unrelated code.

Do not migrate, redesign, or optimize adjacent subsystems unless explicitly requested.

Before expanding scope, explain why it is necessary.

## Lessons from the port

Worth reading before adding a kind, because these came up repeatedly:

- **`@kubernetes/client-node` renames reserved words.** `V1NetworkPolicyIngressRule._from`
  and `V1LimitRangeItem._default` are renamed by the generated client's `ObjectSerializer`
  — which nothing here runs, since payloads are raw JSON from Tauri. So at runtime the
  property is `from` / `default` and the declared name is always `undefined`. Both were
  live bugs. Check any type with a reserved-word field.
- **`as any` hides dead code.** `horizontalPodAutoscalersStatus.ts` read
  `(hpa.status as any)?.conditions`; the backend requests `autoscaling/v1`, whose status
  has no `conditions` at all, so every HPA showed a grey `Unknown` badge forever. The
  cast is why nobody noticed.
- **Ratio strings are not statuses.** Five legacy helpers returned `"3 / 3"` as the status
  text, which says nothing a column does not already say. Worse, three of them used
  `status.replicas` as the denominator instead of `spec.replicas`, so a StatefulSet asked
  for 3 with 1 pod running rendered `1/1` in success-green — the wedged case shown as
  healthy.
- **Sort on the value, render the string.** `10Gi` sorts before `9Gi` as text and
  `10/10` before `2/2`. Column `value` returns bytes or a number; `cell` renders what the
  apiserver sent.
- **Empty is not the same as none.** An empty `podSelector: {}` selects _all_ pods; empty
  `resourceNames` means _every_ object; an unset webhook `failurePolicy` defaults to
  `Fail`. Rendering these as `—` inverts their meaning.
