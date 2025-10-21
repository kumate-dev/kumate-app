import { useEffect, useState } from 'react';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { K8sContext } from '../layouts/Sidebar';

type WatchEvent<T> = {
  type: 'ADDED' | 'MODIFIED' | 'DELETED';
  object: T;
};

export function useK8sResources<T>(
  listFn: (params: { name: string; namespace?: string }) => Promise<T[]>,
  context?: K8sContext | null,
  namespace?: string,
  timeoutMs = 15000,
  watchFn?: (params: { name: string; namespace?: string }) => Promise<{ eventName: string }>
) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!context?.name || !listFn) return;
    const name = context.name;
    const nsParam = namespace && namespace !== 'All Namespaces' ? namespace : undefined;

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
        const res = await withTimeout(listFn({ name, namespace: nsParam }), timeoutMs);
        if (active) setItems(res || []);
      } catch (e: any) {
        if (active) setError(e?.message || String(e));
      } finally {
        if (active) setLoading(false);
      }
    }

    async function watch() {
      if (!watchFn) return;
      try {
        const { eventName } = await withTimeout(watchFn({ name, namespace: nsParam }), timeoutMs);
        unlisten = await listen<WatchEvent<T>>(eventName, (evt) => {
          const { type, object } = evt.payload;
          setItems((prev) => {
            switch (type) {
              case 'ADDED':
                if (prev.find((i: any) => (i as any).name === (object as any).name)) return prev;
                return [...prev, object];
              case 'MODIFIED':
                return prev.map((i: any) =>
                  (i as any).name === (object as any).name ? object : i
                );
              case 'DELETED':
                return prev.filter((i: any) => (i as any).name !== (object as any).name);
              default:
                return prev;
            }
          });
        });
      } catch (err) {
        console.error('Failed to start watch:', err);
      }
    }

    async function setup() {
      await list();
      await watch();
    }

    setup();

    return () => {
      active = false;
      if (unlisten) unlisten();
    };
  }, [context?.name, namespace, listFn, watchFn, timeoutMs]);

  return { items, loading, error };
}
