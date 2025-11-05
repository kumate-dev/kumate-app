import { useCallback } from 'react';
import { V1Ingress, V1Namespace } from '@kubernetes/client-node';
import { useNamespaceStore } from '@/store/namespaceStore';
import { useSelectedNamespaces } from '@/hooks/useSelectedNamespaces';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import {
  listIngresses,
  watchIngresses,
  deleteIngresses,
  createIngress,
  updateIngress,
} from '@/api/k8s/ingresses';
import { useDeleteK8sResources } from '@/hooks/useDeleteK8sResources';
import { toast } from 'sonner';
import PaneIngresses from '../components/PaneIngresses';
import { PaneResourceContextProps } from '../../generic/components/PaneGeneric';
import { useCreateK8sResource } from '@/hooks/useCreateK8sResource';
import { useUpdateK8sResource } from '@/hooks/useUpdateK8sResource';

export default function Ingresses({ context }: PaneResourceContextProps) {
  const selectedNamespaces = useNamespaceStore((s) => s.selectedNamespaces);
  const setSelectedNamespaces = useNamespaceStore((s) => s.setSelectedNamespaces);

  const namespaceList = useSelectedNamespaces(context);

  const { items, loading, error } = useListK8sResources<V1Ingress>(
    listIngresses,
    watchIngresses,
    context,
    selectedNamespaces
  );
  const { handleCreateResource } = useCreateK8sResource<V1Ingress>(createIngress, context);
  const { handleUpdateResource } = useUpdateK8sResource<V1Ingress>(updateIngress, context);
  const { handleDeleteResources } = useDeleteK8sResources<V1Ingress>(deleteIngresses, context);

  const handleDelete = useCallback(
    async (items: V1Ingress[]) => {
      if (items.length === 0) {
        toast.error('No Ingress selected');
        return;
      }
      await handleDeleteResources(items);
    },
    [handleDeleteResources]
  );

  return (
    <PaneIngresses
      selectedNamespaces={selectedNamespaces}
      onSelectNamespace={setSelectedNamespaces}
      namespaceList={namespaceList as unknown as V1Namespace[]}
      items={items}
      loading={loading}
      error={error ?? ''}
      onDeleteIngresses={handleDelete}
      onCreate={handleCreateResource}
      onUpdate={handleUpdateResource}
      contextName={context?.name}
    />
  );
}
