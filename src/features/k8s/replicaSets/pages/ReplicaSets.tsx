import { useCallback } from 'react';
import { V1ReplicaSet } from '@kubernetes/client-node';
import { useNamespaceStore } from '@/store/namespaceStore';
import { useSelectedNamespaces } from '@/hooks/useSelectedNamespaces';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import { listReplicaSets, watchReplicaSets, deleteReplicaSets } from '@/api/k8s/replicaSets';
import { useDeleteK8sResources } from '@/hooks/useDeleteK8sResources';
import { toast } from 'sonner';
import PaneReplicaSets from '../components/PaneReplicaSets';
import { PaneResourceContextProps } from '../../common/components/PaneGeneric';

export default function ReplicaSets({ context }: PaneResourceContextProps) {
  const selectedNamespaces = useNamespaceStore((s) => s.selectedNamespaces);
  const setSelectedNamespaces = useNamespaceStore((s) => s.setSelectedNamespaces);

  const namespaceList = useSelectedNamespaces(context);

  const { items, loading, error } = useListK8sResources<V1ReplicaSet>(
    listReplicaSets,
    watchReplicaSets,
    context,
    selectedNamespaces
  );

  const { handleDeleteResources } = useDeleteK8sResources<V1ReplicaSet>(deleteReplicaSets, context);

  const handleDeleteReplicaSets = useCallback(
    async (replicaSets: V1ReplicaSet[]) => {
      if (replicaSets.length === 0) {
        toast.error('No ReplicaSets selected');
        return;
      }
      await handleDeleteResources(replicaSets);
    },
    [handleDeleteResources]
  );

  return (
    <PaneReplicaSets
      selectedNamespaces={selectedNamespaces}
      onSelectNamespace={setSelectedNamespaces}
      namespaceList={namespaceList}
      items={items}
      loading={loading}
      error={error ?? ''}
      onDeleteReplicaSets={handleDeleteReplicaSets}
    />
  );
}
