import { useEffect, useState } from 'react';
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

  useEffect(() => {
    if (!context?.name || !listFn) return;

    const clusterName = context.name;
    const nsList = namespaces && !namespaces.includes(ALL_NAMESPACES) ? namespaces : undefined;

    let active = true;
    let unlisten: UnlistenFn | null = null;

    const withTimeout = <U>(p: Promise<U>, ms: number) =>
      new Promise<U>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error(`Request timed out after ${ms}ms`)), ms);
        p.then((v) => {
          clearTimeout(t);
          resolve(v);
        }).catch((e) => {
          clearTimeout(t);
          reject(e);
        });
      });

    function dedupeResources(items: T[]): T[] {
      const seen = new Set<string>();
      return items.filter((item) => {
        const metadata = item.metadata;
        const key = `${metadata?.namespace || ''}/${metadata?.name || ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    async function list() {
      setLoading(true);
      setError('');
      try {
        const results = await withTimeout(
          listFn({ name: clusterName, namespaces: nsList }),
          K8S_REQUEST_TIMEOUT
        );
        if (active) setItems(dedupeResources(results || []));
      } catch (e: any) {
        if (active) setError(e?.message || String(e));
      } finally {
        if (active) setLoading(false);
      }
    }

    async function watch() {
      if (!watchFn) return;
      try {
        const { unlisten: u } = await withTimeout(
          watchFn({
            name: clusterName,
            namespaces: nsList,
            onEvent: (evt) => {
              const { type, object } = evt;
              const metadata = object.metadata;
              const key = `${metadata?.namespace || ''}/${metadata?.name || ''}`;

              setItems((prev) => {
                const map = new Map(
                  prev.map((i) => {
                    const m = i.metadata;
                    return [`${m?.namespace || ''}/${m?.name || ''}`, i];
                  })
                );

                switch (type) {
                  case 'ADDED':
                  case 'MODIFIED':
                    map.set(key, object);
                    break;
                  case 'DELETED':
                    map.delete(key);
                    break;
                }

                return Array.from(map.values());
              });
            },
          }),
          K8S_REQUEST_TIMEOUT
        );

        unlisten = u;
      } catch (err) {
        console.error('Failed to start watch:', err);
      }
    }

    list();
    watch();

    return () => {
      active = false;
      unlisten?.();
      unwatch({ name: clusterName });
    };
  }, [context?.name, namespaces, listFn, watchFn]);

  return { items, loading, error };
}
