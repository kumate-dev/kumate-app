import { useCallback } from 'react';
import type { V1ClusterRoleBinding } from '@kubernetes/client-node';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import {
  listClusterRoleBindings,
  watchClusterRoleBindings,
  deleteClusterRoleBindings,
  createClusterRoleBinding,
  updateClusterRoleBinding,
} from '@/api/k8s/clusterRoleBindings';
import { useDeleteK8sResources } from '@/hooks/useDeleteK8sResources';
import { useCreateK8sResource } from '@/hooks/useCreateK8sResource';
import { useUpdateK8sResource } from '@/hooks/useUpdateK8sResource';
import { toast } from 'sonner';
import PaneClusterRoleBindings from '../components/PaneClusterRoleBindings';
import { PaneResourceContextProps } from '../../generic/components/PaneGeneric';

export default function ClusterRoleBindings({ context }: PaneResourceContextProps) {
  const { items, loading, error } = useListK8sResources<V1ClusterRoleBinding>(
    listClusterRoleBindings,
    watchClusterRoleBindings,
    context
  );

  const { handleCreateResource } = useCreateK8sResource<V1ClusterRoleBinding>(
    createClusterRoleBinding,
    context
  );
  const { handleUpdateResource } = useUpdateK8sResource<V1ClusterRoleBinding>(
    updateClusterRoleBinding,
    context
  );
  const { handleDeleteResources } = useDeleteK8sResources<V1ClusterRoleBinding>(
    deleteClusterRoleBindings,
    context
  );

  const handleDelete = useCallback(async (rbs: V1ClusterRoleBinding[]) => {
    if (!rbs.length) {
      toast.error('No ClusterRoleBindings selected');
      return;
    }
    await handleDeleteResources(rbs);
  }, [handleDeleteResources]);

  return (
    <PaneClusterRoleBindings
      items={items}
      loading={loading}
      error={error ?? ''}
      onDeleteClusterRoleBindings={handleDelete}
      onCreate={handleCreateResource}
      onUpdate={handleUpdateResource}
      contextName={context?.name}
    />
  );
}