import { useCallback } from 'react';
import type { V1ClusterRole } from '@kubernetes/client-node';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import {
  listClusterRoles,
  watchClusterRoles,
  deleteClusterRoles,
  createClusterRole,
  updateClusterRole,
} from '@/api/k8s/clusterRoles';
import { useDeleteK8sResources } from '@/hooks/useDeleteK8sResources';
import { useCreateK8sResource } from '@/hooks/useCreateK8sResource';
import { useUpdateK8sResource } from '@/hooks/useUpdateK8sResource';
import { toast } from 'sonner';
import PaneClusterRoles from '../components/PaneClusterRoles';
import { PaneResourceContextProps } from '../../generic/components/PaneGeneric';

export default function ClusterRoles({ context }: PaneResourceContextProps) {
  const { items, loading, error } = useListK8sResources<V1ClusterRole>(
    listClusterRoles,
    watchClusterRoles,
    context
  );

  const { handleCreateResource } = useCreateK8sResource<V1ClusterRole>(
    createClusterRole,
    context
  );
  const { handleUpdateResource } = useUpdateK8sResource<V1ClusterRole>(
    updateClusterRole,
    context
  );
  const { handleDeleteResources } = useDeleteK8sResources<V1ClusterRole>(
    deleteClusterRoles,
    context
  );

  const handleDelete = useCallback(async (roles: V1ClusterRole[]) => {
    if (!roles.length) {
      toast.error('No ClusterRoles selected');
      return;
    }
    await handleDeleteResources(roles);
  }, [handleDeleteResources]);

  return (
    <PaneClusterRoles
      items={items}
      loading={loading}
      error={error ?? ''}
      onDeleteClusterRoles={handleDelete}
      onCreate={handleCreateResource}
      onUpdate={handleUpdateResource}
      contextName={context?.name}
    />
  );
}