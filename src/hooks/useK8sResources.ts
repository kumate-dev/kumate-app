import { useEffect, useState } from 'react';
import { UnlistenFn } from '@tauri-apps/api/event';
import { K8S_REQUEST_TIMEOUT, ALL_NAMESPACES } from '../constants/k8s';
import { WatchEvent } from '../types/k8sEvent';
import { unwatch } from '../services/unwatch';

export function useK8sResources<T>(
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

    async function list() {
      setLoading(true);
      setError('');
      try {
        const results = await withTimeout(
          listFn({ name: clusterName, namespaces: nsList }),
          K8S_REQUEST_TIMEOUT
        );
        if (active) setItems(results || []);
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

              setItems((prev) => {
                let newList: typeof prev;

                switch (type) {
                  case 'ADDED':
                    if (prev.find((f: any) => (f as any).name === (object as any).name)) {
                      newList = prev.map((f: any) =>
                        (f as any).name === (object as any).name ? object : f
                      );
                    } else {
                      newList = [...prev, object];
                    }
                    break;

                  case 'MODIFIED':
                    newList = prev.map((f: any) =>
                      (f as any).name === (object as any).name ? object : f
                    );
                    break;

                  case 'DELETED':
                    newList = prev.filter((f: any) => (f as any).name !== (object as any).name);
                    break;

                  default:
                    newList = prev;
                }

                return [...newList].sort((a: any, b: any) => a.name.localeCompare(b.name));
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
  }, [context?.name, namespaces?.join(','), listFn, watchFn]);

  return { items, loading, error };
}
