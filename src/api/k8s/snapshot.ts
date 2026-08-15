import { invoke } from '@tauri-apps/api/core';

export interface ResourceSnapshot<T> {
  /**
   * True when every stream for this watch has finished its initial listing, so
   * `items` is authoritative — **including when it is empty**.
   *
   * False means a listing is still in flight and the `SYNCED` event is still coming.
   */
  synced: boolean;
  items: T[];
}

/**
 * Current contents of the backend's in-memory cache for a watch.
 *
 * Served from `ResourceStore` without touching the apiserver, so this is free to call.
 *
 * Two jobs:
 *
 * 1. Make a screen correct when it attaches to a watch that is *already* running. The
 *    backend only emits the initial `ADDED`/`SYNCED` burst when it opens a stream, so a
 *    second consumer would otherwise see nothing until the next cluster-side change.
 * 2. Resolve the empty-vs-not-loaded ambiguity via `synced`. The backend emits its
 *    initial burst the moment `watch_*` returns, but the frontend can only start
 *    listening after that call resolves — on an empty resource the whole sequence is
 *    over in milliseconds, before any listener exists. Without `synced` the UI could not
 *    tell "no ConfigMaps here" from "still loading" and showed a skeleton forever.
 */
export async function snapshotResources<T>({
  eventName,
}: {
  eventName: string;
}): Promise<ResourceSnapshot<T>> {
  try {
    const result = await invoke<ResourceSnapshot<T>>('snapshot_resources', { eventName });
    return { synced: result?.synced ?? false, items: result?.items ?? [] };
  } catch (err) {
    // A missing snapshot is never fatal — the watch stream is the source of truth and
    // will populate the list on its own. Reporting `synced: false` keeps the caller
    // waiting for the marker rather than declaring an empty list authoritative.
    console.warn('snapshot_resources failed:', err);
    return { synced: false, items: [] };
  }
}
