import { unwatch } from '@/api/k8s/unwatch';

/**
 * Reference counting for backend watches.
 *
 * ## The bug this fixes
 *
 * A watch is identified by its event-channel name, and the backend deliberately
 * short-circuits `watch_*` when one is already registered for that name:
 *
 * ```rust
 * if entries.contains_key(&event_name) { return Ok(()); }
 * ```
 *
 * That is correct — two screens watching the same kind must share one stream — but it
 * means the *frontend* owns the lifecycle, and it was getting it wrong in both
 * directions:
 *
 * 1. **Nothing ever called `unwatch`.** `createResourceList`'s cleanup only removed its
 *    local listener, so the backend stream stayed registered forever. Watches
 *    accumulated until `MAX_WATCHERS` (64) was reached, at which point the eviction
 *    path started killing live watches and screens silently stopped updating.
 * 2. **Returning to a kind produced an empty screen.** Because the stream was still
 *    registered, `watch_*` returned the same event name *without* starting a new stream
 *    — so it never re-emitted `InitApply`/`SYNCED`. The new listener attached to a
 *    channel that had already said everything it was going to say, and the table sat on
 *    a skeleton forever. From the outside this looks exactly like a disconnect.
 *
 * Naively calling `unwatch` in cleanup fixes (1) and makes (2) worse: during a route
 * transition Solid creates the incoming screen before disposing the outgoing one, so an
 * exact `unwatch` from the outgoing screen tears down the stream the incoming screen
 * just acquired.
 *
 * Hence refcounting. `acquire` on start, `release` on cleanup, and the backend is only
 * told to stop when the last consumer has gone.
 */

const counts = new Map<string, number>();

export const acquireWatch = (eventName: string): void => {
  counts.set(eventName, (counts.get(eventName) ?? 0) + 1);
};

/**
 * Drop one reference. Stops the backend watch when it was the last one.
 *
 * Fire-and-forget: `unwatch` already swallows its own errors, and a failed teardown
 * must not block a route change.
 */
export const releaseWatch = (eventName: string): void => {
  const next = (counts.get(eventName) ?? 1) - 1;

  if (next > 0) {
    counts.set(eventName, next);
    return;
  }

  counts.delete(eventName);
  void unwatch({ name: eventName });
};

/** How many screens currently hold this watch. Exposed for diagnostics and tests. */
export const watchRefCount = (eventName: string): number => counts.get(eventName) ?? 0;

/** Every watch the frontend believes it holds. Should track the backend's `active` list. */
export const heldWatches = (): string[] => [...counts.keys()];
