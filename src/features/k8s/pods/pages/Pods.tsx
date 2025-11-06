import { useCallback } from 'react';
import { V1Pod } from '@kubernetes/client-node';
import { useNamespaceStore } from '@/store/namespaceStore';
import { useSelectedNamespaces } from '@/hooks/useSelectedNamespaces';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import { listPods, watchPods, deletePods, createPod, updatePod } from '@/api/k8s/pods';
import { useDeleteK8sResources } from '@/hooks/useDeleteK8sResources';
import { toast } from 'sonner';
import PanePods from '../components/PanePods';
import { PaneResourceContextProps } from '../../generic/components/PaneGeneric';
import { useCreateK8sResource } from '@/hooks/useCreateK8sResource';
import { useUpdateK8sResource } from '@/hooks/useUpdateK8sResource';

export default function Pods({ context }: PaneResourceContextProps) {
  const selectedNamespaces = useNamespaceStore((s) => s.selectedNamespaces);
  const setSelectedNamespaces = useNamespaceStore((s) => s.setSelectedNamespaces);

  const namespaceList = useSelectedNamespaces(context);

  const { items, loading, error } = useListK8sResources<V1Pod>(
    listPods,
    watchPods,
    context,
    selectedNamespaces
  );

  const { handleCreateResource, creating: creatingPod } = useCreateK8sResource<V1Pod>(
    createPod,
    context
  );
  const { handleUpdateResource, updating: updatingPod } = useUpdateK8sResource<V1Pod>(
    updatePod,
    context
  );
  const { handleDeleteResources, deleting: deletingPods } = useDeleteK8sResources<V1Pod>(
    deletePods,
    context
  );

  const handleDeletePods = useCallback(
    async (pods: V1Pod[]) => {
      if (!pods?.length) {
        toast.error('No pods selected');
        return;
      }
      await handleDeleteResources(pods);
    },
    [handleDeleteResources]
  );

  const handleCreatePod = useCallback(
    async (manifest: V1Pod): Promise<V1Pod | undefined> => {
      try {
        const result = await handleCreateResource(manifest);
        return result || undefined;
      } catch (error) {
        console.error('Failed to create pod:', error);
        return undefined;
      }
    },
    [handleCreateResource]
  );

  const handleUpdatePod = useCallback(
    async (manifest: V1Pod): Promise<V1Pod | undefined> => {
      try {
        const result = await handleUpdateResource(manifest);
        return result || undefined;
      } catch (error) {
        console.error('Failed to update pod:', error);
        return undefined;
      }
    },
    [handleUpdateResource]
  );

  return (
    <PanePods
      selectedNamespaces={selectedNamespaces}
      onSelectNamespace={setSelectedNamespaces}
      namespaceList={namespaceList}
      items={items}
      loading={loading}
      error={error ?? ''}
      onCreate={handleCreatePod}
      onDelete={handleDeletePods}
      onUpdate={handleUpdatePod}
      contextName={context?.name}
      creating={creatingPod}
      updating={updatingPod}
      deleting={deletingPods}
    />
  );
}
