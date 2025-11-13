import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  checkContextConnection,
  getContextConnection,
  getContextConnections,
  setContextConnection,
} from '@/api/k8s/contexts';

export interface UseContextConnections {
  connMap: Record<string, boolean | null>;
  setConnected: (name: string, connected: boolean) => Promise<boolean>;
}

export function useContextConnections(refreshContexts: () => Promise<void>): UseContextConnections {
  const [connMap, setConnMap] = useState<Record<string, boolean | null>>({});

  // Load current connection map once on mount
  useEffect(() => {
    getContextConnections()
      .then((items) => {
        const m: Record<string, boolean | null> = {};
        for (const it of items) m[it.name] = it.connected;
        setConnMap(m);
      })
      .catch(() => {});
  }, []);

  const setConnected = useCallback(
    async (name: string, connected: boolean): Promise<boolean> => {
      try {
        await setContextConnection(name, connected);

        if (connected) {
          try {
            await checkContextConnection(name);
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            toast.error(`Connect failed: ${msg || 'Unknown error during connection check'}`);
            return false;
          }
        }
        try {
          const latest = await getContextConnection(name);
          setConnMap((prev) => ({ ...prev, [name]: latest }));
        } catch {}
        if (connected) {
          toast.success(`Connected to ${name}`);
        } else {
          toast.error(`Disconnected from ${name}`);
        }
        try {
          await refreshContexts();
        } catch {}
        return true;
      } catch (err) {
        const actionText = connected ? 'Connect' : 'Disconnect';
        const msg = err instanceof Error ? err.message : String(err);
        toast.error(`${actionText} failed: ${msg}`);
        return false;
      }
    },
    [refreshContexts]
  );

  return { connMap, setConnected };
}
