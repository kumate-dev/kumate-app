import { useCallback, useEffect, useState } from 'react';
import { importKubeContexts, listContexts, K8sContext } from '@/api/k8s/contexts';

export interface UseKubeContexts {
  contexts: K8sContext[];
  selected: K8sContext | null;
  setSelected: React.Dispatch<React.SetStateAction<K8sContext | null>>;
  loading: boolean;
  error: string;
  refreshContexts: () => Promise<void>;
}

export function useKubeContexts(): UseKubeContexts {
  const [contexts, setContexts] = useState<K8sContext[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [selected, setSelected] = useState<K8sContext | null>(null);

  const refreshContexts = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      try {
        await importKubeContexts();
      } catch {}

      let list: K8sContext[] = [];
      try {
        list = (await listContexts()) || [];
      } catch {
        setContexts([]);
        setSelected(null);
        return;
      }
      setContexts(list);

      setSelected((prev) => {
        // If nothing is selected, default to the first
        if (!prev) return list.length > 0 ? list[0] : null;
        // Keep selection if still present, otherwise clear
        const existing = list.find((c) => c.name === prev.name) || null;
        return existing;
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshContexts();
  }, [refreshContexts]);

  return { contexts, selected, setSelected, loading, error, refreshContexts };
}
