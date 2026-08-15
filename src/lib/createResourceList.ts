import { createSignal, createEffect, onCleanup, type Accessor } from 'solid-js';
import { createStore, produce, reconcile } from 'solid-js/store';
import type { UnlistenFn } from '@tauri-apps/api/event';
import { snapshotResources } from '@/api/k8s/snapshot';
import { unwatchCluster } from '@/api/k8s/unwatch';
import { ALL_NAMESPACES } from '@/constants/k8s';
import { getErrorMessage } from '@/utils/error';
import { resourceKey, type K8sObject } from '@/lib/k8s';
import { acquireWatch, releaseWatch } from '@/lib/watchRegistry';
import { isWatchFailure, type WatchEvent } from '@/types/k8sEvent';

export type ListFn<T> = (params: { name: string; namespaces?: string[] }) => Promise<T[]>;

export type WatchFn<T> = (params: {
  name: string;
  namespaces?: string[];
  onEvent?: (evt: WatchEvent<T>) => void;
}) => Promise<{ eventName: string; unlisten: UnlistenFn }>;

export interface ResourceSource<T> {
  list: ListFn<T>;
  watch?: WatchFn<T>;
}

export type ListStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface ResourceList<T> {
  items: Accessor<readonly T[]>;
  status: Accessor<ListStatus>;
  error: Accessor<string | null>;
  /** Event-channel name of the live watch, or `null`. Needed to `unwatch`. */
  eventName: Accessor<string | null>;
  refetch: () => void;
}

/**
 * Live list of one Kubernetes resource kind, backed by a watch.
 *
 * ## Why this replaces `useListK8sResources` rather than porting it
 *
 * The React hook had four structural problems, all of which disappear here:
 *
 * 1. It called `list_*` **and** `watch_*` on every mount. The backend's watch already
 *    opens with a full initial listing (`Init` → `InitApply`* → `InitDone`), so the
 *    list call was pure duplicated traffic. We now watch only, and fall back to
 *    `list` if the kind has no watch or the watch fails to start.
 * 2. It called `setLoading(false)` and wrote the cache **inside** a `setItems`
 *    updater — a side effect in a reducer, which double-fires under StrictMode.
 *    Loading now ends on the `SYNCED` marker the backend emits, which is
 *    deterministic instead of "whenever the first event happens to arrive".
 * 3. It rebuilt a `Map` from the entire list on **every** watch event — O(n) per
 *    event, O(n²) during a rollout. We keep a persistent key→index map.
 * 4. Every event replaced the object reference, so `<For>` would discard and rebuild
 *    the row and reference-based selection broke. We `reconcile` in place, which
 *    preserves references: only the bindings for fields that actually changed update,
 *    and the row DOM is untouched. This is the main reason the port is worth doing.
 */
export function createResourceList<T extends K8sObject>(
  source: ResourceSource<T>,
  context: Accessor<string | null | undefined>,
  namespaces: Accessor<string[] | undefined>
): ResourceList<T> {
  const [store, setStore] = createStore<{ items: T[] }>({ items: [] });
  const [status, setStatus] = createSignal<ListStatus>('idle');
  const [error, setError] = createSignal<string | null>(null);
  const [eventName, setEventName] = createSignal<string | null>(null);
  const [reloadToken, setReloadToken] = createSignal(0);

  /** key → index into `store.items`. Kept in sync so updates are O(1). */
  let index = new Map<string, number>();

  const rebuildIndex = (items: readonly T[]) => {
    index = new Map();
    items.forEach((item, i) => index.set(resourceKey(item), i));
  };

  const replaceAll = (next: T[]) => {
    // `reconcile` diffs against what is already there instead of swapping the array,
    // so rows that did not change keep their identity and their DOM.
    setStore('items', reconcile(next, { key: null }));
    rebuildIndex(next);
  };

  const upsert = (object: T) => {
    const key = resourceKey(object);
    const existing = index.get(key);

    if (existing === undefined) {
      setStore(
        produce((draft) => {
          draft.items.push(object);
        })
      );
      index.set(key, store.items.length - 1);
      return;
    }

    // Reconcile the single element: Solid walks the object and updates only the
    // leaves that differ. A pod whose `status.containerStatuses[0].restartCount`
    // ticked re-renders one text node, not a row.
    setStore('items', existing, reconcile(object, { key: null }));
  };

  const remove = (object: T) => {
    const key = resourceKey(object);
    const existing = index.get(key);
    if (existing === undefined) return;

    setStore(
      produce((draft) => {
        draft.items.splice(existing, 1);
      })
    );
    // Deletion shifts every later index, so the map has to be rebuilt. Deletes are
    // far rarer than modifications, so paying O(n) here to keep updates O(1) is the
    // right trade.
    rebuildIndex(store.items);
  };

  createEffect(() => {
    const clusterName = context();
    reloadToken();

    if (!clusterName) {
      replaceAll([]);
      setStatus('idle');
      return;
    }

    // `ALL_NAMESPACES` is a UI sentinel, not a real namespace: send `undefined` so
    // the backend uses a single cluster-wide watch instead of one per namespace.
    const selected = namespaces();
    const nsList = !selected || selected.includes(ALL_NAMESPACES) ? undefined : selected;

    let disposed = false;
    let unlisten: UnlistenFn | null = null;
    /** Set once the watch is acquired, so cleanup releases exactly what it took. */
    let heldEventName: string | null = null;

    const onEvent = (evt: WatchEvent<T>) => {
      if (disposed) return;

      switch (evt.type) {
        case 'ADDED':
        case 'MODIFIED':
          upsert(evt.object);
          break;
        case 'DELETED':
          remove(evt.object);
          break;
        case 'SYNCED':
          // The backend has finished its initial listing (or a recovery relist) and
          // has already emitted synthetic DELETEs for anything that vanished. What we
          // hold is now authoritative.
          setStatus('ready');
          setError(null);
          break;
        case 'FAILED':
          // The watch has failed repeatedly and never synced — almost always an RBAC
          // denial on this kind. Surface it instead of leaving a skeleton up forever.
          setError(isWatchFailure(evt.object) ? evt.object.message : `Cannot watch ${clusterName}`);
          setStatus('error');
          break;
      }
    };

    const start = async () => {
      setStatus('loading');
      setError(null);

      if (source.watch) {
        try {
          const started = await source.watch({ name: clusterName, namespaces: nsList, onEvent });
          acquireWatch(started.eventName);

          if (disposed) {
            started.unlisten();
            releaseWatch(started.eventName);
            return;
          }
          unlisten = started.unlisten;
          heldEventName = started.eventName;
          setEventName(started.eventName);

          // Seed from the backend cache.
          //
          // The backend returns the existing event name when a watch for this exact
          // selection is already running, and in that case it does NOT replay the
          // initial `InitApply`/`SYNCED` burst — it already happened. Without this
          // seed, navigating away from a kind and back attaches a listener to a
          // channel that has nothing left to say, and the table sits on a skeleton
          // forever. That was the "disconnect on tab switch" bug.
          //
          // When the backend did open a fresh stream, the snapshot is empty or partial
          // and the incoming events fill it in; `upsert` is idempotent, so seeding and
          // streaming cannot conflict.
          const cached = await snapshotResources<T>({ eventName: started.eventName });
          if (disposed) return;

          // Only seed if the stream has not already delivered anything, so a live
          // stream's fresher data is never overwritten by an older snapshot.
          if (cached.items.length > 0 && store.items.length === 0) {
            replaceAll(cached.items);
          }

          // `synced` means the backend finished listing before we attached a listener,
          // so the `SYNCED` marker we are waiting for has already been and gone. Without
          // this, a resource with no objects never leaves the loading state — there is
          // nothing left to arrive and nothing to distinguish "empty" from "pending".
          if (cached.synced) setStatus('ready');
          return;
        } catch (err) {
          // Fall through to a plain list: a kind without watch support, or a watch
          // that could not be registered, should still render something.
          console.warn('watch failed, falling back to list', err);
        }
      }

      try {
        const items = await source.list({ name: clusterName, namespaces: nsList });
        if (disposed) return;
        replaceAll(items ?? []);
        setStatus('ready');
      } catch (err) {
        if (disposed) return;
        setError(getErrorMessage(err));
        setStatus('error');
      }
    };

    void start();

    onCleanup(() => {
      disposed = true;
      unlisten?.();

      // Hand the backend watch back. Refcounted, because Solid creates the incoming
      // screen before disposing the outgoing one during a route change — an
      // unconditional `unwatch` here would tear down the stream the new screen just
      // acquired. See `lib/watchRegistry.ts`.
      if (heldEventName) releaseWatch(heldEventName);
      heldEventName = null;

      setEventName(null);
      // Local state is dropped so a cluster or namespace switch never paints the
      // previous selection's rows.
      replaceAll([]);
    });
  });

  return {
    items: () => store.items,
    status,
    error,
    eventName,
    refetch: () => setReloadToken((n) => n + 1),
  };
}

/**
 * Stop every watch belonging to a cluster.
 *
 * Call this when the selected cluster changes. `createResourceList`'s cleanup stops
 * the watches it started itself, but a cluster switch should also collect anything
 * left behind by a page that was unmounted without cleanup running.
 */
export const stopClusterWatches = (clusterName: string) => unwatchCluster({ context: clusterName });
