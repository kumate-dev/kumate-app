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
import { createResourceQuota, updateResourceQuota } from '@/api/k8s/resourceQuotas';
import { useDeleteK8sResources } from '@/hooks/useDeleteK8sResources';
import { toast } from 'sonner';
import PaneResourceQuotas from '../components/PaneResourceQuotas';
import { PaneResourceContextProps } from '../../generic/components/PaneGeneric';
import { useCreateK8sResource } from '@/hooks/useCreateK8sResource';
import { useUpdateK8sResource } from '@/hooks/useUpdateK8sResource';

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
  const { handleCreateResource, creating } = useCreateK8sResource<V1ResourceQuota>(
    createResourceQuota,
    context
  );
  const { handleUpdateResource, updating } = useUpdateK8sResource<V1ResourceQuota>(
    updateResourceQuota,
    context
  );
  const { handleDeleteResources, deleting } = useDeleteK8sResources<V1ResourceQuota>(
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

  const handleCreateResourceQuota = useCallback(
    async (manifest: V1ResourceQuota): Promise<V1ResourceQuota | undefined> => {
      try {
        const result = await handleCreateResource(manifest);
        return result || undefined;
      } catch (error) {
        console.error('Failed to create resource quota:', error);
        return undefined;
      }
    },
    [handleCreateResource]
  );

  const handleUpdateResourceQuota = useCallback(
    async (manifest: V1ResourceQuota): Promise<V1ResourceQuota | undefined> => {
      try {
        const result = await handleUpdateResource(manifest);
        return result || undefined;
      } catch (error) {
        console.error('Failed to update resource quota:', error);
        return undefined;
      }
    },
    [handleUpdateResource]
  );

  return (
    <PaneResourceQuotas
      selectedNamespaces={selectedNamespaces}
      onSelectNamespace={setSelectedNamespaces}
      namespaceList={namespaceList}
      items={items}
      loading={loading}
      error={error ?? ''}
      onDelete={handleDeleteResourceQuotas}
      onCreate={handleCreateResourceQuota}
      onUpdate={handleUpdateResourceQuota}
      contextName={context?.name}
      creating={creating}
      updating={updating}
      deleting={deleting}
    />
  );
}
