import { useCallback } from 'react';
import { V1ReplicationController } from '@kubernetes/client-node';
import { useNamespaceStore } from '@/store/namespaceStore';
import { useSelectedNamespaces } from '@/hooks/useSelectedNamespaces';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import {
  listReplicationControllers,
  watchReplicationControllers,
  deleteReplicationControllers,
} from '@/api/k8s/replicationControllers';
import { useDeleteK8sResources } from '@/hooks/useDeleteK8sResources';
import { toast } from 'sonner';
import PaneReplicationControllers from '../components/PaneReplicationControllers';
import { PaneResourceContextProps } from '../../generic/components/PaneGeneric';

export default function ReplicationControllers({ context }: PaneResourceContextProps) {
  const selectedNamespaces = useNamespaceStore((s) => s.selectedNamespaces);
  const setSelectedNamespaces = useNamespaceStore((s) => s.setSelectedNamespaces);

  const namespaceList = useSelectedNamespaces(context);

  const { items, loading, error } = useListK8sResources<V1ReplicationController>(
    listReplicationControllers,
    watchReplicationControllers,
    context,
    selectedNamespaces
  );

  const { handleDeleteResources } = useDeleteK8sResources<V1ReplicationController>(
    deleteReplicationControllers,
    context
  );

  const handleDeleteReplicationControllers = useCallback(
    async (replicationControllers: V1ReplicationController[]) => {
      if (replicationControllers.length === 0) {
        toast.error('No ReplicationControllers selected');
        return;
      }
      await handleDeleteResources(replicationControllers);
    },
    [handleDeleteResources]
  );

  return (
    <PaneReplicationControllers
      selectedNamespaces={selectedNamespaces}
      onSelectNamespace={setSelectedNamespaces}
      namespaceList={namespaceList}
      items={items}
      loading={loading}
      error={error ?? ''}
      onDeleteReplicationControllers={handleDeleteReplicationControllers}
    />
  );
}
