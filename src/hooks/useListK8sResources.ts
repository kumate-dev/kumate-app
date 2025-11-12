import { useEffect, useState, useRef } from 'react';
import { UnlistenFn } from '@tauri-apps/api/event';
import { K8S_REQUEST_TIMEOUT, ALL_NAMESPACES, K8S_RESOURCE_CACHE_TTL_MS } from '@/constants/k8s';
import { WatchEvent } from '@/types/k8sEvent';
import { getResourceCache, setResourceCacheWithTTL } from '@/store/k8sResourceCache';
import { unwatchContext } from '@/api/k8s/unwatch';

export function useListK8sResources<T extends { metadata?: { name?: string; namespace?: string } }>(
  listFn: (params: { name: string; namespaces?: string[] }) => Promise<T[]>,
  watchFn?: (params: {
    name: string;
    namespaces?: string[];
    onEvent?: (evt: WatchEvent<T>) => void;
  }) => Promise<{ eventName: string; unlisten: UnlistenFn }>,
  context?: { name: string } | null,
  namespaces?: string[]
) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const listFnRef = useRef(listFn);
  const watchFnRef = useRef(watchFn);
  const cacheKeyRef = useRef<string | null>(null);
  const prevClusterRef = useRef<string | null>(null);
  listFnRef.current = listFn;
  watchFnRef.current = watchFn;

  useEffect(() => {
    if (!context?.name || !listFnRef.current) return;

    const clusterName = context.name;
    // If the cluster changed, proactively unwatch all watchers for the previous cluster to prevent leaks
    if (prevClusterRef.current && prevClusterRef.current !== clusterName) {
      void unwatchContext({ prefix: `k8s://${prevClusterRef.current}/` });
    }
    prevClusterRef.current = clusterName;
    const nsList = namespaces?.includes(ALL_NAMESPACES) ? undefined : namespaces;

    let active = true;
    let unlisten: UnlistenFn | null = null;

    const withTimeout = <U>(promise: Promise<U>, ms: number): Promise<U> =>
      Promise.race([
        promise,
        new Promise<U>((_, reject) =>
          setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms)
        ),
      ]);

    const getItemKey = (item: T): string =>
      `${item.metadata?.namespace || ''}/${item.metadata?.name || ''}`;

    const dedupeResources = (resources: T[]): T[] => {
      const seen = new Set<string>();
      return resources.filter((item) => {
        const key = getItemKey(item);
        return !seen.has(key) && seen.add(key);
      });
    };

    const handleWatchEvent = (evt: WatchEvent<T>): void => {
      const { type, object } = evt;
      const key = getItemKey(object);

      setItems((prev) => {
        const itemMap = new Map(prev.map((item) => [getItemKey(item), item]));

        switch (type) {
          case 'ADDED':
          case 'MODIFIED':
            {
              const existing = itemMap.get(key);
              // Merge shallowly to preserve fields that may be omitted in watch payloads
              const merged = existing
                ? ({ ...(existing as any), ...(object as any) } as T)
                : object;
              itemMap.set(key, merged);
            }
            break;
          case 'DELETED':
            itemMap.delete(key);
            break;
        }

        const next = Array.from(itemMap.values());
        // Mark loading as complete once we start receiving watch events
        setLoading(false);
        // Update cache so revisiting the page can render instantly
        if (cacheKeyRef.current) {
          setResourceCacheWithTTL<T>(cacheKeyRef.current, next, K8S_RESOURCE_CACHE_TTL_MS);
        }
        return next;
      });
    };

    const listResources = async (): Promise<void> => {
      // If we already have cached data, avoid flipping loading to true again
      const hasCache = cacheKeyRef.current ? !!getResourceCache<T>(cacheKeyRef.current) : false;
      if (!hasCache) setLoading(true);
      setError('');

      try {
        const results = await withTimeout(
          listFnRef.current({ name: clusterName, namespaces: nsList }),
          K8S_REQUEST_TIMEOUT
        );

        if (active) {
          const next = dedupeResources(results || []);
          setItems(next);
          if (cacheKeyRef.current) {
            setResourceCacheWithTTL<T>(cacheKeyRef.current, next, K8S_RESOURCE_CACHE_TTL_MS);
          }
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    const watchResources = async (): Promise<string | null> => {
      if (!watchFnRef.current) return null;

      try {
        const { eventName, unlisten: watchUnlisten } = await withTimeout(
          watchFnRef.current({
            name: clusterName,
            namespaces: nsList,
            onEvent: handleWatchEvent,
          }),
          K8S_REQUEST_TIMEOUT
        );

        unlisten = watchUnlisten;
        cacheKeyRef.current = eventName;

        // Prime UI from cache if available
        const cached = getResourceCache<T>(eventName);
        if (active && cached && cached.length > 0) {
          setItems(cached);
          setLoading(false);
        }
        return eventName;
      } catch (err) {
        console.error('Failed to start watch:', err);
        return null;
      }
    };

    const executeOperations = async (): Promise<void> => {
      await watchResources();
      void listResources();
    };

    executeOperations();

    return () => {
      active = false;
      unlisten?.();
    };
  }, [context?.name, namespaces]);

  return { items, loading, error };
}
