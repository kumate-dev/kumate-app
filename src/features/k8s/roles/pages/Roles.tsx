import { useCallback } from 'react';
import type { V1Role } from '@kubernetes/client-node';
import { useNamespaceStore } from '@/store/namespaceStore';
import { useSelectedNamespaces } from '@/hooks/useSelectedNamespaces';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import { listRoles, watchRoles, deleteRoles, createRole, updateRole } from '@/api/k8s/roles';
import { useDeleteK8sResources } from '@/hooks/useDeleteK8sResources';
import { useCreateK8sResource } from '@/hooks/useCreateK8sResource';
import { useUpdateK8sResource } from '@/hooks/useUpdateK8sResource';
import { toast } from 'sonner';
import PaneRoles from '../components/PaneRoles';
import { PaneResourceContextProps } from '../../generic/components/PaneGeneric';

export default function Roles({ context }: PaneResourceContextProps) {
  const selectedNamespaces = useNamespaceStore((s) => s.selectedNamespaces);
  const setSelectedNamespaces = useNamespaceStore((s) => s.setSelectedNamespaces);
  const namespaceList = useSelectedNamespaces(context);

  const { items, loading, error } = useListK8sResources<V1Role>(
    listRoles,
    watchRoles,
    context,
    selectedNamespaces
  );

  const { handleCreateResource } = useCreateK8sResource<V1Role>(createRole, context);
  const { handleUpdateResource } = useUpdateK8sResource<V1Role>(updateRole, context);
  const { handleDeleteResources } = useDeleteK8sResources<V1Role>(deleteRoles, context);

  const handleDeleteRoles = useCallback(
    async (roles: V1Role[]) => {
      if (roles.length === 0) {
        toast.error('No Roles selected');
        return;
      }
      await handleDeleteResources(roles);
    },
    [handleDeleteResources]
  );

  return (
    <PaneRoles
      selectedNamespaces={selectedNamespaces}
      onSelectNamespace={setSelectedNamespaces}
      namespaceList={namespaceList}
      items={items}
      loading={loading}
      error={error ?? ''}
      onDelete={handleDeleteRoles}
      onCreate={handleCreateResource}
      onUpdate={handleUpdateResource}
      contextName={context?.name}
    />
  );
}
