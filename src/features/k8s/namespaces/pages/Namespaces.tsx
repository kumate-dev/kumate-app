import { useCallback } from 'react';
import { V1Namespace } from '@kubernetes/client-node';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import {
  listNamespaces,
  watchNamespaces,
  deleteNamespaces,
  createNamespace,
  updateNamespace,
} from '@/api/k8s/namespaces';
import PaneNamespaces from '../components/PaneNamespaces';
import { PaneResourceContextProps } from '../../generic/components/PaneGeneric';
import { useDeleteK8sResources } from '@/hooks/useDeleteK8sResources';
import { toast } from 'sonner';
import { useCreateK8sResource } from '@/hooks/useCreateK8sResource';
import { useUpdateK8sResource } from '@/hooks/useUpdateK8sResource';

export default function Namespaces({ context }: PaneResourceContextProps) {
  const { items, loading, error } = useListK8sResources<V1Namespace>(
    listNamespaces,
    watchNamespaces,
    context
  );
  const { handleDeleteResources, deleting } = useDeleteK8sResources<V1Namespace>(
    deleteNamespaces,
    context
  );

  const { handleCreateResource, creating } = useCreateK8sResource<V1Namespace>(
    createNamespace,
    context
  );
  const { handleUpdateResource, updating } = useUpdateK8sResource<V1Namespace>(
    updateNamespace,
    context
  );

  const handleDeleteNamespaces = useCallback(
    async (namespaces: V1Namespace[]) => {
      if (namespaces.length === 0) {
        toast.error('No Namespaces selected');
        return;
      }
      await handleDeleteResources(namespaces);
    },
    [handleDeleteResources]
  );

  return (
    <PaneNamespaces
      items={items}
      loading={loading}
      error={error ?? ''}
      onDelete={handleDeleteNamespaces}
      contextName={context?.name}
      deleting={deleting}
      onCreate={handleCreateResource}
      onUpdate={handleUpdateResource}
      creating={creating}
      updating={updating}
    />
  );
}
