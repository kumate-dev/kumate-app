# Kubernetes layer

## Watch, never poll

Polling is banned. The one surviving poll loop is a 5s `setInterval` in
`src/features/k8s/portForwarding/pages/PortForwarding.tsx` and it should be replaced
with an event.

## Why `kube-runtime`, emphatically

The `runtime` feature is enabled in `Cargo.toml`. Do not remove it.

Before it, three copies of a hand-rolled `Api::watch(&WatchParams, "")` loop drove
every watch. Raw watch gives you no `resourceVersion` bookmarking, no relist on
`410 Gone`, and no reconnect. The apiserver ends watch streams routinely — every few
minutes — at which point `while let Some(..) = stream.next().await` fell through, the
task returned, **and the stale `JoinHandle` stayed in `WatchManager`'s map.** Because
`watch()` short-circuited on a present key, every later `watch_*` call for that
resource returned `Ok(())` and started nothing. The UI then showed stale data
indefinitely, with no error, until the user switched clusters.

`watcher()` handles bookmarking, relisting and recovery. `WatchManager` entries are
now removed by the owning task as it exits, so a dead watch is always restartable.

## Event lifecycle and the delete problem

`watcher()` emits `Init` → `InitApply`\* → `InitDone` on start **and after every
recovery relist**. It does not tell you what disappeared while you were not
watching — those objects simply never appear in the new listing.

`watch_loop::run` therefore diffs each init window against `ResourceStore` and
synthesizes the missing `DELETED` events. Without this, the UI shows phantom rows
after a reconnect. This is the main reason `ResourceStore` exists.

Mapping to the wire protocol:

| `watcher::Event`                   | emitted                    | notes                               |
| ---------------------------------- | -------------------------- | ----------------------------------- |
| `Init`                             | —                          | opens the init window               |
| `InitApply(o)`                     | `ADDED`                    | recorded in the init key set        |
| `InitDone`                         | `DELETED`×n, then `SYNCED` | n = objects missing from the relist |
| `Apply(o)`                         | `MODIFIED`                 | upsert                              |
| `Delete(o)`                        | `DELETED`                  |                                     |
| (repeated `Err` before first sync) | `FAILED`                   | after 3 consecutive failures, once  |

Payload shape, unchanged since before the refactor so the frontend is unaffected:

```json
{ "type": "ADDED" | "MODIFIED" | "DELETED" | "SYNCED" | "FAILED", "object": { ... } }
```

`SYNCED` carries `object: null` and means "the set you hold is now authoritative" —
use it to drop a skeleton state. Consumers that don't know it must ignore it.

`FAILED` carries `{ "message": "..." }` and is emitted only when a watch has failed
repeatedly and has **never** synced — an RBAC denial on the kind being the usual cause.
`watcher()` retries forever, so without this the UI waits on a stream that will never
deliver and shows a loading skeleton indefinitely. Errors _after_ a successful sync are
deliberately silent: the rows on screen are still valid and the watcher recovers itself.

### The initial-sync race, and why `snapshot_resources` returns `synced`

The backend emits its initial `ADDED` burst and `SYNCED` the moment `watch_*` returns,
but the frontend can only attach its listener _after_ that call resolves. On a fast or
empty resource the whole sequence is over before anyone is listening, so an empty result
is ambiguous: "this kind has nothing in it" and "the listing has not happened yet" look
identical.

`ResourceStore` therefore tracks, per event name, which shards have completed their
first listing. Each stream registers its shard _before_ it is polled — every sibling
does so on the first poll of the `join_all`, long before any network round trip can
finish — so `is_synced` can never claim readiness while a namespace is still loading.
`snapshot_resources` returns `{ synced, items }`, and the UI only leaves its loading
state when `synced` is true or a `SYNCED` event arrives. Do not "simplify" this back to
a bare list: an empty kind will hang on a skeleton forever.

## Event channel naming

```
k8s://<context>/<resource>
k8s://<context>/<resource>/ns/<ns1,ns2>          namespaces sorted + deduped
k8s://<context>/custom_resources/<group>/<version>/<plural>
k8s://<context>/pod_logs/<ns>/<pod>[/<container>]
```

Built only by `utils::watcher::build_event_name`. Namespaces are sorted so the same
selection always yields the same key regardless of UI ordering. `cluster_prefix()`
reads only the first segment, which is what makes per-cluster teardown
(`unwatch_prefix("k8s://ctx/")`) work even for multi-segment keys.

## ResourceStore

Shard per `(event_name, namespace)`, holding `Arc<Value>` per object. It exists for
three reasons: correct deletes across reconnects (above), a snapshot source
(`snapshot_resources` serves a full list with zero apiserver traffic), and bounded
memory — `managedFields` is stripped before objects are cached or serialized, which
typically halves the retained size and the IPC payload.

A shard is dropped when the stream that maintains it stops. **The cache must never
outlive its watch**, or it will serve data nothing is correcting.

## Client caching

`ClientRegistry` caches one `kube::Client` per context, 30-minute TTL. Building a
client decrypts the stored kubeconfig, parses YAML, negotiates TLS, and for
EKS/GKE may exec an auth plugin — and it used to happen on _every command and every
watch_. Concurrent cold-start callers are serialized by a per-context build lock so
one page of pods triggers one auth-plugin exec, not dozens.

Invalidate on disconnect and whenever a stored kubeconfig changes.
`for_context_fresh` bypasses the cache and is used by connectivity probes, where a
stale client would mask a real credential failure.

## Watch limits

`MAX_WATCHERS = 64`. Eviction prefers other clusters' watches, then the oldest.
The previous version iterated a `HashMap` in arbitrary order, so which watch died
was effectively random.
