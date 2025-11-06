import { useEffect, useState, useRef } from 'react';
import { UnlistenFn } from '@tauri-apps/api/event';
import { K8S_REQUEST_TIMEOUT, ALL_NAMESPACES } from '@/constants/k8s';
import { WatchEvent } from '@/types/k8sEvent';
import { unwatch } from '@/api/k8s/unwatch';

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
  listFnRef.current = listFn;
  watchFnRef.current = watchFn;

  useEffect(() => {
    if (!context?.name || !listFnRef.current) return;

    const clusterName = context.name;
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
            itemMap.set(key, object);
            break;
          case 'DELETED':
            itemMap.delete(key);
            break;
        }

        return Array.from(itemMap.values());
      });
    };

    const listResources = async (): Promise<void> => {
      setLoading(true);
      setError('');

      try {
        const results = await withTimeout(
          listFnRef.current({ name: clusterName, namespaces: nsList }),
          K8S_REQUEST_TIMEOUT
        );

        if (active) {
          setItems(dedupeResources(results || []));
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

    const watchResources = async (): Promise<void> => {
      if (!watchFnRef.current) return;

      try {
        const { unlisten: watchUnlisten } = await withTimeout(
          watchFnRef.current({
            name: clusterName,
            namespaces: nsList,
            onEvent: handleWatchEvent,
          }),
          K8S_REQUEST_TIMEOUT
        );

        unlisten = watchUnlisten;
      } catch (err) {
        console.error('Failed to start watch:', err);
      }
    };

    const executeOperations = async (): Promise<void> => {
      await listResources();
      await watchResources();
    };

    executeOperations();

    return () => {
      active = false;
      unlisten?.();
      unwatch({ name: clusterName });
    };
  }, [context?.name, namespaces]);

  return { items, loading, error };
}
