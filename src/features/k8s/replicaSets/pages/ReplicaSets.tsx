import { useCallback } from 'react';
import { V1ReplicaSet } from '@kubernetes/client-node';
import { useNamespaceStore } from '@/store/namespaceStore';
import { useSelectedNamespaces } from '@/hooks/useSelectedNamespaces';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import {
  listReplicaSets,
  watchReplicaSets,
  deleteReplicaSets,
  createReplicaSet,
  updateReplicaSet,
} from '@/api/k8s/replicaSets';
import { useDeleteK8sResources } from '@/hooks/useDeleteK8sResources';
import { toast } from 'sonner';
import PaneReplicaSets from '../components/PaneReplicaSets';
import { PaneResourceContextProps } from '../../generic/components/PaneGeneric';
import { useCreateK8sResource } from '@/hooks/useCreateK8sResource';
import { useUpdateK8sResource } from '@/hooks/useUpdateK8sResource';

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
  const { handleCreateResource, creating: creatingReplicaSet } = useCreateK8sResource<V1ReplicaSet>(
    createReplicaSet,
    context
  );
  const { handleUpdateResource, updating: updatingReplicaSet } = useUpdateK8sResource<V1ReplicaSet>(
    updateReplicaSet,
    context
  );
  const { handleDeleteResources, deleting: deletingReplicaSets } =
    useDeleteK8sResources<V1ReplicaSet>(deleteReplicaSets, context);

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

  const handleCreateReplicaSet = useCallback(
    async (manifest: V1ReplicaSet): Promise<V1ReplicaSet | undefined> => {
      try {
        const result = await handleCreateResource(manifest);
        return result || undefined;
      } catch (error) {
        console.error('Failed to create replica set:', error);
        return undefined;
      }
    },
    [handleCreateResource]
  );

  const handleUpdateReplicaSet = useCallback(
    async (manifest: V1ReplicaSet): Promise<V1ReplicaSet | undefined> => {
      try {
        const result = await handleUpdateResource(manifest);
        return result || undefined;
      } catch (error) {
        console.error('Failed to update replica set:', error);
        return undefined;
      }
    },
    [handleUpdateResource]
  );

  return (
    <PaneReplicaSets
      selectedNamespaces={selectedNamespaces}
      onSelectNamespace={setSelectedNamespaces}
      namespaceList={namespaceList}
      items={items}
      loading={loading}
      error={error ?? ''}
      onDelete={handleDeleteReplicaSets}
      onCreate={handleCreateReplicaSet}
      onUpdate={handleUpdateReplicaSet}
      contextName={context?.name}
      creating={creatingReplicaSet}
      updating={updatingReplicaSet}
      deleting={deletingReplicaSets}
    />
  );
}
