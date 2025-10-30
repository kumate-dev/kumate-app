import { useCallback } from 'react';
import { V1PodDisruptionBudget } from '@kubernetes/client-node';
import { useNamespaceStore } from '@/store/namespaceStore';
import { useSelectedNamespaces } from '@/hooks/useSelectedNamespaces';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import {
  listPodDisruptionBudgets,
  watchPodDisruptionBudgets,
  deletePodDisruptionBudgets,
} from '@/api/k8s/podDisruptionBudgets';
import { useDeleteK8sResources } from '@/hooks/useDeleteK8sResources';
import { toast } from 'sonner';
import PanePodDisruptionBudgets from '../components/PanePodDisruptionBudgets';
import { PaneResourceContextProps } from '../../generic/components/PaneGeneric';

export default function PodDisruptionBudgets({ context }: PaneResourceContextProps) {
  const selectedNamespaces = useNamespaceStore((s) => s.selectedNamespaces);
  const setSelectedNamespaces = useNamespaceStore((s) => s.setSelectedNamespaces);

  const namespaceList = useSelectedNamespaces(context);

  const { items, loading, error } = useListK8sResources<V1PodDisruptionBudget>(
    listPodDisruptionBudgets,
    watchPodDisruptionBudgets,
    context,
    selectedNamespaces
  );

  const { handleDeleteResources } = useDeleteK8sResources<V1PodDisruptionBudget>(
    deletePodDisruptionBudgets,
    context
  );

  const handleDeletePodDisruptionBudgets = useCallback(
    async (pdbs: V1PodDisruptionBudget[]) => {
      if (pdbs.length === 0) {
        toast.error('No PodDisruptionBudgets selected');
        return;
      }
      await handleDeleteResources(pdbs);
    },
    [handleDeleteResources]
  );

  return (
    <PanePodDisruptionBudgets
      selectedNamespaces={selectedNamespaces}
      onSelectNamespace={setSelectedNamespaces}
      namespaceList={namespaceList}
      items={items}
      loading={loading}
      error={error ?? ''}
      onDeletePodDisruptionBudgets={handleDeletePodDisruptionBudgets}
    />
  );
}
