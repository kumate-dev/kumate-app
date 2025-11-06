import { useEffect, useState, useCallback } from 'react';
import type { K8sContext } from '@/api/k8s/contexts';
import { listPortForwards, type PortForwardItemDto, stopPortForward } from '@/api/k8s/portForward';
import { useNamespaceStore } from '@/store/namespaceStore';
import { useSelectedNamespaces } from '@/hooks/useSelectedNamespaces';
import { PanePortForwards } from '@/features/k8s/portForwarding/components/PanePortForwards';

export default function PortForwarding({ context }: { context?: K8sContext | null }) {
  const [items, setItems] = useState<PortForwardItemDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const selectedNamespaces = useNamespaceStore((s) => s.selectedNamespaces);
  const setSelectedNamespaces = useNamespaceStore((s) => s.setSelectedNamespaces);
  const namespaceList = useSelectedNamespaces(context);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const res = await listPortForwards();
      setItems(res);
      setError('');
    } catch (e: any) {
      setError(e?.message || 'Failed to list port forwards');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Poll for updates so new sessions started elsewhere show up automatically
  useEffect(() => {
    const id = setInterval(() => {
      refresh();
    }, 3000);
    return () => clearInterval(id);
  }, [refresh]);

  const handleDeleteSelected = useCallback(
    async (toDelete: PortForwardItemDto[]) => {
      for (const it of toDelete) {
        try {
          await stopPortForward(it.sessionId);
        } catch (e) {
          // ignore per-item errors for batch delete
          console.error('Failed to stop port-forward', it.sessionId, e);
        }
      }
      await refresh();
    },
    [refresh]
  );

  return (
    <PanePortForwards
      selectedNamespaces={selectedNamespaces}
      onSelectNamespace={setSelectedNamespaces}
      namespaceList={namespaceList as any}
      items={items}
      loading={loading}
      error={error}
      onDelete={handleDeleteSelected}
      contextName={context?.name}
      onStopItem={async (item) => {
        await stopPortForward(item.sessionId);
        await refresh();
      }}
    />
  );
}
