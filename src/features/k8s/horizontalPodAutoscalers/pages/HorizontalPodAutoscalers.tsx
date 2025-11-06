import { useCallback } from 'react';
import { V1HorizontalPodAutoscaler } from '@kubernetes/client-node';
import { useNamespaceStore } from '@/store/namespaceStore';
import { useSelectedNamespaces } from '@/hooks/useSelectedNamespaces';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import {
  listHorizontalPodAutoscalers,
  watchHorizontalPodAutoscalers,
  deleteHorizontalPodAutoscalers,
} from '@/api/k8s/horizontalPodAutoscalers';
import {
  createHorizontalPodAutoscaler,
  updateHorizontalPodAutoscaler,
} from '@/api/k8s/horizontalPodAutoscalers';
import { useDeleteK8sResources } from '@/hooks/useDeleteK8sResources';
import { toast } from 'sonner';
import PaneHorizontalPodAutoscalers from '../components/PaneHorizontalPodAutoscalers';
import { PaneResourceContextProps } from '../../generic/components/PaneGeneric';
import { useCreateK8sResource } from '@/hooks/useCreateK8sResource';
import { useUpdateK8sResource } from '@/hooks/useUpdateK8sResource';

export default function HorizontalPodAutoscalers({ context }: PaneResourceContextProps) {
  const selectedNamespaces = useNamespaceStore((s) => s.selectedNamespaces);
  const setSelectedNamespaces = useNamespaceStore((s) => s.setSelectedNamespaces);

  const namespaceList = useSelectedNamespaces(context);

  const { items, loading, error } = useListK8sResources<V1HorizontalPodAutoscaler>(
    listHorizontalPodAutoscalers,
    watchHorizontalPodAutoscalers,
    context,
    selectedNamespaces
  );

  const { handleDeleteResources } = useDeleteK8sResources<V1HorizontalPodAutoscaler>(
    deleteHorizontalPodAutoscalers,
    context
  );

  const { handleCreateResource } = useCreateK8sResource<V1HorizontalPodAutoscaler>(
    createHorizontalPodAutoscaler,
    context
  );
  const { handleUpdateResource } = useUpdateK8sResource<V1HorizontalPodAutoscaler>(
    updateHorizontalPodAutoscaler,
    context
  );

  const handleDeleteHorizontalPodAutoscalers = useCallback(
    async (hpas: V1HorizontalPodAutoscaler[]) => {
      if (hpas.length === 0) {
        toast.error('No HPAs selected');
        return;
      }
      await handleDeleteResources(hpas);
    },
    [handleDeleteResources]
  );

  return (
    <PaneHorizontalPodAutoscalers
      selectedNamespaces={selectedNamespaces}
      onSelectNamespace={setSelectedNamespaces}
      namespaceList={namespaceList}
      items={items}
      loading={loading}
      error={error ?? ''}
      onDelete={handleDeleteHorizontalPodAutoscalers}
      onCreate={handleCreateResource}
      onUpdate={handleUpdateResource}
      contextName={context?.name}
    />
  );
}
