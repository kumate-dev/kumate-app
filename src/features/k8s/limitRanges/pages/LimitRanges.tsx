import { useCallback } from 'react';
import { V1LimitRange } from '@kubernetes/client-node';
import { useNamespaceStore } from '@/store/namespaceStore';
import { useSelectedNamespaces } from '@/hooks/useSelectedNamespaces';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import { listLimitRanges, watchLimitRanges, deleteLimitRanges } from '@/api/k8s/limitRanges';
import { useDeleteK8sResources } from '@/hooks/useDeleteK8sResources';
import { toast } from 'sonner';
import PaneLimitRanges from '../components/PaneLimitRanges';
import { PaneResourceContextProps } from '../../generic/components/PaneGeneric';

export default function LimitRanges({ context }: PaneResourceContextProps) {
  const selectedNamespaces = useNamespaceStore((s) => s.selectedNamespaces);
  const setSelectedNamespaces = useNamespaceStore((s) => s.setSelectedNamespaces);

  const namespaceList = useSelectedNamespaces(context);

  const { items, loading, error } = useListK8sResources<V1LimitRange>(
    listLimitRanges,
    watchLimitRanges,
    context,
    selectedNamespaces
  );

  const { handleDeleteResources } = useDeleteK8sResources<V1LimitRange>(deleteLimitRanges, context);

  const handleDeleteLimitRanges = useCallback(
    async (limitRanges: V1LimitRange[]) => {
      if (limitRanges.length === 0) {
        toast.error('No limit ranges selected');
        return;
      }
      await handleDeleteResources(limitRanges);
    },
    [handleDeleteResources]
  );

  return (
    <PaneLimitRanges
      selectedNamespaces={selectedNamespaces}
      onSelectNamespace={setSelectedNamespaces}
      namespaceList={namespaceList}
      items={items}
      loading={loading}
      error={error ?? ''}
      onDeleteLimitRanges={handleDeleteLimitRanges}
    />
  );
}
