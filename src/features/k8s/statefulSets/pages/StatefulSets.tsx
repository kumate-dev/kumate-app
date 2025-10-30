import { useCallback } from 'react';
import { V1StatefulSet } from '@kubernetes/client-node';
import { useNamespaceStore } from '@/store/namespaceStore';
import { useSelectedNamespaces } from '@/hooks/useSelectedNamespaces';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import { listStatefulSets, watchStatefulSets, deleteStatefulSets } from '@/api/k8s/statefulSets';
import { useDeleteK8sResources } from '@/hooks/useDeleteK8sResources';
import { toast } from 'sonner';
import PaneStatefulSets from '../components/PaneStatefulSets';
import { PaneResourceContextProps } from '../../generic/components/PaneGeneric';

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

  const { handleDeleteResources } = useDeleteK8sResources<V1StatefulSet>(
    deleteStatefulSets,
    context
  );

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

  return (
    <PaneStatefulSets
      selectedNamespaces={selectedNamespaces}
      onSelectNamespace={setSelectedNamespaces}
      namespaceList={namespaceList}
      items={items}
      loading={loading}
      error={error ?? ''}
      onDeleteStatefulSets={handleDeleteStatefulSets}
    />
  );
}
