use serde::Serialize;

/// Watch event discriminator sent to the frontend as `payload.type`.
///
/// `ADDED` / `MODIFIED` / `DELETED` mirror the Kubernetes watch verbs and are
/// what the UI reduces over.
///
/// `SYNCED` is a payload-less marker emitted once the initial listing for a watch is
/// complete (and again after every recovery relist).
///
/// `FAILED` is emitted only when a watch keeps failing *before* it has ever synced —
/// an RBAC denial on the kind being the common case. Without it the stream retries
/// forever, nothing ever arrives, and the UI shows a loading skeleton indefinitely with
/// no indication that anything is wrong. Errors after a successful sync are not
/// reported: the rows already on screen remain valid and the watcher recovers on its
/// own. `object` carries `{ "message": "..." }`.
///
/// Keep in sync with `WatchEventType` in `src/types/k8sEvent.ts`.
#[derive(Serialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum EventType {
    ADDED,
    MODIFIED,
    DELETED,
    SYNCED,
    FAILED,
}
