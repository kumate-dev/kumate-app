import { useCallback } from 'react';
import type { V1ServiceAccount } from '@kubernetes/client-node';
import { useNamespaceStore } from '@/store/namespaceStore';
import { useSelectedNamespaces } from '@/hooks/useSelectedNamespaces';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import {
  listServiceAccounts,
  watchServiceAccounts,
  deleteServiceAccounts,
  createServiceAccount,
  updateServiceAccount,
} from '@/api/k8s/serviceAccounts';
import { useDeleteK8sResources } from '@/hooks/useDeleteK8sResources';
import { useCreateK8sResource } from '@/hooks/useCreateK8sResource';
import { useUpdateK8sResource } from '@/hooks/useUpdateK8sResource';
import { toast } from 'sonner';
import PaneServiceAccounts from '../components/PaneServiceAccounts';
import { PaneResourceContextProps } from '../../generic/components/PaneGeneric';

export default function ServiceAccounts({ context }: PaneResourceContextProps) {
  const selectedNamespaces = useNamespaceStore((s) => s.selectedNamespaces);
  const setSelectedNamespaces = useNamespaceStore((s) => s.setSelectedNamespaces);
  const namespaceList = useSelectedNamespaces(context);

  const { items, loading, error } = useListK8sResources<V1ServiceAccount>(
    listServiceAccounts,
    watchServiceAccounts,
    context,
    selectedNamespaces
  );

  const { handleCreateResource, creating } = useCreateK8sResource<V1ServiceAccount>(
    createServiceAccount,
    context
  );
  const { handleUpdateResource, updating } = useUpdateK8sResource<V1ServiceAccount>(
    updateServiceAccount,
    context
  );
  const { handleDeleteResources, deleting } = useDeleteK8sResources<V1ServiceAccount>(
    deleteServiceAccounts,
    context
  );

  const handleDeleteServiceAccounts = useCallback(
    async (sas: V1ServiceAccount[]) => {
      if (sas.length === 0) {
        toast.error('No ServiceAccounts selected');
        return;
      }
      await handleDeleteResources(sas);
    },
    [handleDeleteResources]
  );

  return (
    <PaneServiceAccounts
      selectedNamespaces={selectedNamespaces}
      onSelectNamespace={setSelectedNamespaces}
      namespaceList={namespaceList}
      items={items}
      loading={loading}
      error={error ?? ''}
      onDelete={handleDeleteServiceAccounts}
      onCreate={handleCreateResource}
      onUpdate={handleUpdateResource}
      contextName={context?.name}
      creating={creating}
      updating={updating}
      deleting={deleting}
    />
  );
}
