import { useCallback } from 'react';
import { V1Pod } from '@kubernetes/client-node';
import { useNamespaceStore } from '@/store/namespaceStore';
import { useSelectedNamespaces } from '@/hooks/useSelectedNamespaces';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import { listPods, watchPods, deletePods, createPod } from '@/api/k8s/pods';
import { useDeleteK8sResources } from '@/hooks/useDeleteK8sResources';
import { toast } from 'sonner';
import PanePods from '../components/PanePods';
import { PaneResourceContextProps } from '../../generic/components/PaneGeneric';
import { useCreateK8sResource } from '@/hooks/useCreateK8sResource';

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

  const { handleDeleteResources } = useDeleteK8sResources<V1Pod>(deletePods, context);

  const handleDeletePods = useCallback(
    async (pods: V1Pod[]) => {
      if (pods.length === 0) {
        toast.error('No pods selected');
        return;
      }
      await handleDeleteResources(pods);
    },
    [handleDeleteResources]
  );

  const { handleCreateResource } = useCreateK8sResource<V1Pod>(createPod, context);

  return (
    <PanePods
      selectedNamespaces={selectedNamespaces}
      onSelectNamespace={setSelectedNamespaces}
      namespaceList={namespaceList}
      items={items}
      loading={loading}
      error={error ?? ''}
      onDeletePods={handleDeletePods}
      onCreatePod={handleCreateResource}
    />
  );
}
