import { useCallback } from 'react';
import type { V1Lease, V1Namespace } from '@kubernetes/client-node';
import { useNamespaceStore } from '@/store/namespaceStore';
import { useSelectedNamespaces } from '@/hooks/useSelectedNamespaces';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import { useDeleteK8sResources } from '@/hooks/useDeleteK8sResources';
import { useCreateK8sResource } from '@/hooks/useCreateK8sResource';
import { useUpdateK8sResource } from '@/hooks/useUpdateK8sResource';
import { listLeases, watchLeases, createLease, updateLease, deleteLeases } from '@/api/k8s/leases';
import PaneLeases from '../components/PaneLeases';
import { PaneResourceContextProps } from '../../generic/components/PaneGeneric';
import { toast } from 'sonner';

export default function Leases({ context }: PaneResourceContextProps) {
  const selectedNamespaces = useNamespaceStore((s) => s.selectedNamespaces);
  const setSelectedNamespaces = useNamespaceStore((s) => s.setSelectedNamespaces);

  const namespaceList: V1Namespace[] = useSelectedNamespaces(context);

  const { items, loading, error } = useListK8sResources<V1Lease>(
    listLeases,
    watchLeases,
    context,
    selectedNamespaces
  );

  const { handleCreateResource } = useCreateK8sResource<V1Lease>(createLease, context);
  const { handleUpdateResource } = useUpdateK8sResource<V1Lease>(updateLease, context);
  const { handleDeleteResources } = useDeleteK8sResources<V1Lease>(deleteLeases, context);

  const handleDeleteLeases = useCallback(
    async (leases: V1Lease[]) => {
      if (leases.length === 0) {
        toast.error('No Leases selected');
        return;
      }
      await handleDeleteResources(leases);
    },
    [handleDeleteResources]
  );

  return (
    <PaneLeases
      selectedNamespaces={selectedNamespaces}
      onSelectNamespace={setSelectedNamespaces}
      namespaceList={namespaceList}
      items={items}
      loading={loading}
      error={error ?? ''}
      onDeleteLeases={handleDeleteLeases}
      onCreate={handleCreateResource}
      onUpdate={handleUpdateResource}
      contextName={context?.name}
    />
  );
}
