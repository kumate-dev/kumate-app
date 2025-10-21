import { useEffect, useState } from 'react';
import { watchNamespaces, unwatchNamespaces, NamespaceItem } from '../services/k8s';

export interface NamespaceEvent {
  type: 'ADDED' | 'MODIFIED' | 'DELETED';
  object: NamespaceItem;
}

interface UseNamespacesWatcherResult {
  items: NamespaceItem[];
  error: string;
}

export function useNamespacesWatcher(name?: string): UseNamespacesWatcherResult {
  const [items, setItems] = useState<NamespaceItem[]>([]);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!name) return;
    let unlisten: (() => void) | undefined;

    const setup = async () => {
      try {
        const watcher = await watchNamespaces({
          name,
          onEvent: (evt: NamespaceEvent) => {
            setItems((prev) => {
              switch (evt.type) {
                case 'ADDED':
                  if (!prev.find((i) => i.name === evt.object.name)) {
                    return [...prev, evt.object];
                  }
                  return prev;
                case 'MODIFIED':
                  return prev.map((i) => (i.name === evt.object.name ? evt.object : i));
                case 'DELETED':
                  return prev.filter((i) => i.name !== evt.object.name);
              }
            });
          },
        });

        unlisten = watcher.unlisten;
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : String(e));
      }
    };

    setup();

    return () => {
      unlisten?.();
      unwatchNamespaces({ name }).catch(() => {});
      setItems([]);
    };
  }, [name]);

  return { items, error };
}
