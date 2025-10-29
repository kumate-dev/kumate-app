import { useCallback } from 'react';
import { V1ResourceQuota } from '@kubernetes/client-node';
import { useNamespaceStore } from '@/store/namespaceStore';
import { useSelectedNamespaces } from '@/hooks/useSelectedNamespaces';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import {
  listResourceQuotas,
  watchResourceQuotas,
  deleteResourceQuotas,
} from '@/api/k8s/resourceQuotas';
import { useDeleteK8sResources } from '@/hooks/useDeleteK8sResources';
import { toast } from 'sonner';
import PaneResourceQuotas from '../components/PaneResourceQuotas';
import { PaneResourceContextProps } from '../../common/components/PaneGeneric';

export default function ResourceQuotas({ context }: PaneResourceContextProps) {
  const selectedNamespaces = useNamespaceStore((s) => s.selectedNamespaces);
  const setSelectedNamespaces = useNamespaceStore((s) => s.setSelectedNamespaces);

  const namespaceList = useSelectedNamespaces(context);

  const { items, loading, error } = useListK8sResources<V1ResourceQuota>(
    listResourceQuotas,
    watchResourceQuotas,
    context,
    selectedNamespaces
  );

  const { handleDeleteResources } = useDeleteK8sResources<V1ResourceQuota>(
    deleteResourceQuotas,
    context
  );

  const handleDeleteResourceQuotas = useCallback(
    async (resourceQuotas: V1ResourceQuota[]) => {
      if (resourceQuotas.length === 0) {
        toast.error('No ResourceQuotas selected');
        return;
      }
      await handleDeleteResources(resourceQuotas);
    },
    [handleDeleteResources]
  );

  return (
    <PaneResourceQuotas
      selectedNamespaces={selectedNamespaces}
      onSelectNamespace={setSelectedNamespaces}
      namespaceList={namespaceList}
      items={items}
      loading={loading}
      error={error ?? ''}
      onDeleteResourceQuotas={handleDeleteResourceQuotas}
    />
  );
}
