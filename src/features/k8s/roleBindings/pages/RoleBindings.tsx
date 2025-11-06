import { useCallback } from 'react';
import type { V1RoleBinding } from '@kubernetes/client-node';
import { useNamespaceStore } from '@/store/namespaceStore';
import { useSelectedNamespaces } from '@/hooks/useSelectedNamespaces';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import {
  listRoleBindings,
  watchRoleBindings,
  deleteRoleBindings,
  createRoleBinding,
  updateRoleBinding,
} from '@/api/k8s/roleBindings';
import { useDeleteK8sResources } from '@/hooks/useDeleteK8sResources';
import { useCreateK8sResource } from '@/hooks/useCreateK8sResource';
import { useUpdateK8sResource } from '@/hooks/useUpdateK8sResource';
import { toast } from 'sonner';
import PaneRoleBindings from '../components/PaneRoleBindings';
import { PaneResourceContextProps } from '../../generic/components/PaneGeneric';

export default function RoleBindings({ context }: PaneResourceContextProps) {
  const selectedNamespaces = useNamespaceStore((s) => s.selectedNamespaces);
  const setSelectedNamespaces = useNamespaceStore((s) => s.setSelectedNamespaces);
  const namespaceList = useSelectedNamespaces(context);

  const { items, loading, error } = useListK8sResources<V1RoleBinding>(
    listRoleBindings,
    watchRoleBindings,
    context,
    selectedNamespaces
  );

  const { handleCreateResource } = useCreateK8sResource<V1RoleBinding>(createRoleBinding, context);
  const { handleUpdateResource } = useUpdateK8sResource<V1RoleBinding>(updateRoleBinding, context);
  const { handleDeleteResources } = useDeleteK8sResources<V1RoleBinding>(
    deleteRoleBindings,
    context
  );

  const handleDeleteRoleBindings = useCallback(
    async (rbs: V1RoleBinding[]) => {
      if (rbs.length === 0) {
        toast.error('No RoleBindings selected');
        return;
      }
      await handleDeleteResources(rbs);
    },
    [handleDeleteResources]
  );

  return (
    <PaneRoleBindings
      selectedNamespaces={selectedNamespaces}
      onSelectNamespace={setSelectedNamespaces}
      namespaceList={namespaceList}
      items={items}
      loading={loading}
      error={error ?? ''}
      onDelete={handleDeleteRoleBindings}
      onCreate={handleCreateResource}
      onUpdate={handleUpdateResource}
      contextName={context?.name}
    />
  );
}
