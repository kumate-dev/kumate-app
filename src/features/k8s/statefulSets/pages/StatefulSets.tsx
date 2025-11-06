import { useCallback } from 'react';
import { V1StatefulSet } from '@kubernetes/client-node';
import { useNamespaceStore } from '@/store/namespaceStore';
import { useSelectedNamespaces } from '@/hooks/useSelectedNamespaces';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import {
  listStatefulSets,
  watchStatefulSets,
  deleteStatefulSets,
  createStatefulSet,
  updateStatefulSet,
} from '@/api/k8s/statefulSets';
import { useDeleteK8sResources } from '@/hooks/useDeleteK8sResources';
import { toast } from 'sonner';
import PaneStatefulSets from '../components/PaneStatefulSets';
import { PaneResourceContextProps } from '../../generic/components/PaneGeneric';
import { useCreateK8sResource } from '@/hooks/useCreateK8sResource';
import { useUpdateK8sResource } from '@/hooks/useUpdateK8sResource';

export default function StatefulSets({ context }: PaneResourceContextProps) {
  const selectedNamespaces = useNamespaceStore((s) => s.selectedNamespaces);
  const setSelectedNamespaces = useNamespaceStore((s) => s.setSelectedNamespaces);

  const namespaceList = useSelectedNamespaces(context);

  const { items, loading, error } = useListK8sResources<V1StatefulSet>(
    listStatefulSets,
    watchStatefulSets,
    context,
    selectedNamespaces
  );
  const { handleCreateResource, creating: creatingStatefulSet } =
    useCreateK8sResource<V1StatefulSet>(createStatefulSet, context);
  const { handleUpdateResource, updating: updatingStatefulSet } =
    useUpdateK8sResource<V1StatefulSet>(updateStatefulSet, context);
  const { handleDeleteResources, deleting: deletingStatefulSets } =
    useDeleteK8sResources<V1StatefulSet>(deleteStatefulSets, context);

  const handleDeleteStatefulSets = useCallback(
    async (statefulSets: V1StatefulSet[]) => {
      if (statefulSets.length === 0) {
        toast.error('No StatefulSets selected');
        return;
      }
      await handleDeleteResources(statefulSets);
    },
    [handleDeleteResources]
  );

  const handleCreateStatefulSet = useCallback(
    async (manifest: V1StatefulSet): Promise<V1StatefulSet | undefined> => {
      try {
        const result = await handleCreateResource(manifest);
        return result || undefined;
      } catch (error) {
        console.error('Failed to create stateful set:', error);
        return undefined;
      }
    },
    [handleCreateResource]
  );

  const handleUpdateStatefulSet = useCallback(
    async (manifest: V1StatefulSet): Promise<V1StatefulSet | undefined> => {
      try {
        const result = await handleUpdateResource(manifest);
        return result || undefined;
      } catch (error) {
        console.error('Failed to update stateful set:', error);
        return undefined;
      }
    },
    [handleUpdateResource]
  );

  return (
    <PaneStatefulSets
      selectedNamespaces={selectedNamespaces}
      onSelectNamespace={setSelectedNamespaces}
      namespaceList={namespaceList}
      items={items}
      loading={loading}
      error={error ?? ''}
      onDelete={handleDeleteStatefulSets}
      onCreate={handleCreateStatefulSet}
      onUpdate={handleUpdateStatefulSet}
      contextName={context?.name}
      creating={creatingStatefulSet}
      updating={updatingStatefulSet}
      deleting={deletingStatefulSets}
    />
  );
}
