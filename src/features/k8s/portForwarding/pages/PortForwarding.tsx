import { useEffect, useState, useCallback } from 'react';
import type { K8sContext } from '@/api/k8s/contexts';
import {
  listPortForwards,
  type PortForwardItemDto,
  stopPortForward,
  resumePortForward,
  deletePortForward,
} from '@/api/k8s/portForward';
import { toast } from 'sonner';
import { useNamespaceStore } from '@/store/namespaceStore';
import { useSelectedNamespaces } from '@/hooks/useSelectedNamespaces';
import { PanePortForwards } from '@/features/k8s/portForwarding/components/PanePortForwards';

const REFRESH_INTERVAL = 3000;

interface PortForwardingProps {
  context?: K8sContext | null;
}

export default function PortForwarding({ context }: PortForwardingProps) {
  const [items, setItems] = useState<PortForwardItemDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const selectedNamespaces = useNamespaceStore((s) => s.selectedNamespaces);
  const setSelectedNamespaces = useNamespaceStore((s) => s.setSelectedNamespaces);
  const namespaceList = useSelectedNamespaces(context);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const portForwards = await listPortForwards();
      setItems(portForwards);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to list port forwards';
      setError(errorMessage);
      console.error('Failed to refresh port forwards:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handlePortForwardAction = useCallback(
    async (action: 'start' | 'stop', sessionId: string) => {
      try {
        const actionFn = action === 'start' ? resumePortForward : stopPortForward;
        await actionFn(sessionId);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        const actionText = action === 'start' ? 'Start' : 'Stop';
        toast.error(`${actionText} failed: ${errorMessage}`);
        console.error(`${actionText} port forward failed:`, err);
      }
    },
    []
  );

  const handleStopItem = useCallback(
    async (item: PortForwardItemDto) => {
      await handlePortForwardAction('stop', item.sessionId);
      await refresh();
    },
    [handlePortForwardAction, refresh]
  );

  const handleStartItem = useCallback(
    async (item: PortForwardItemDto) => {
      await handlePortForwardAction('start', item.sessionId);
      await refresh();
    },
    [handlePortForwardAction, refresh]
  );

  const handleDeleteSelected = useCallback(
    async (toDelete: PortForwardItemDto[]) => {
      const deletePromises = toDelete.map(async (item) => {
        try {
          await deletePortForward(item.sessionId);
        } catch (err) {
          console.error(`Failed to delete port-forward ${item.sessionId}:`, err);
        }
      });

      await Promise.allSettled(deletePromises);
      await refresh();
    },
    [refresh]
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const intervalId = setInterval(refresh, REFRESH_INTERVAL);
    return () => clearInterval(intervalId);
  }, [refresh]);

  return (
    <PanePortForwards
      selectedNamespaces={selectedNamespaces}
      onSelectNamespace={setSelectedNamespaces}
      namespaceList={namespaceList}
      items={items}
      loading={loading}
      error={error}
      onDelete={handleDeleteSelected}
      contextName={context?.name}
      onStopItem={handleStopItem}
      onStartItem={handleStartItem}
    />
  );
}
