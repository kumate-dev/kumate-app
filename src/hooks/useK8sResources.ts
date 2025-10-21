import { useEffect, useState } from 'react';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import { K8sContext } from '../layouts/Sidebar';
import { K8S_REQUEST_TIMEOUT } from '../constants/k8s';

type WatchEvent<T> = {
  type: 'ADDED' | 'MODIFIED' | 'DELETED';
  object: T;
};

export function useK8sResources<T>(
  listFn: (params: { name: string; namespace?: string }) => Promise<T[]>,
  watchFn?: (params: { name: string; namespace?: string }) => Promise<{ eventName: string }>,
  context?: K8sContext | null,
  namespace?: string
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
        const res = await withTimeout(listFn({ name, namespace: nsParam }), K8S_REQUEST_TIMEOUT);
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
        const { eventName } = await withTimeout(
          watchFn({ name, namespace: nsParam }),
          K8S_REQUEST_TIMEOUT
        );
        unlisten = await listen<WatchEvent<T>>(eventName, (evt) => {
          const { type, object } = evt.payload;
          setItems((prev) => {
            switch (type) {
              case 'ADDED':
                if (prev.find((f: any) => (f as any).name === (object as any).name)) return prev;
                return [...prev, object];
              case 'MODIFIED':
                return prev.map((f: any) =>
                  (f as any).name === (object as any).name ? object : f
                );
              case 'DELETED':
                return prev.filter((f: any) => (f as any).name !== (object as any).name);
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
  }, [context?.name, namespace, listFn, watchFn, K8S_REQUEST_TIMEOUT]);

  return { items, loading, error };
}
