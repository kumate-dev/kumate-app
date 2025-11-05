import { useCallback } from 'react';
import { V1Endpoints } from '@kubernetes/client-node';
import { useNamespaceStore } from '@/store/namespaceStore';
import { useSelectedNamespaces } from '@/hooks/useSelectedNamespaces';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import {
  listEndpoints,
  watchEndpoints,
  deleteEndpoints,
  createEndpoints,
  updateEndpoints,
} from '@/api/k8s/endpoints';
import { useDeleteK8sResources } from '@/hooks/useDeleteK8sResources';
import { toast } from 'sonner';
import PaneEndpoints from '../components/PaneEndpoints';
import { PaneResourceContextProps } from '../../generic/components/PaneGeneric';
import { useCreateK8sResource } from '@/hooks/useCreateK8sResource';
import { useUpdateK8sResource } from '@/hooks/useUpdateK8sResource';

export default function Endpoints({ context }: PaneResourceContextProps) {
  const selectedNamespaces = useNamespaceStore((s) => s.selectedNamespaces);
  const setSelectedNamespaces = useNamespaceStore((s) => s.setSelectedNamespaces);

  const namespaceList = useSelectedNamespaces(context);

  const { items, loading, error } = useListK8sResources<V1Endpoints>(
    listEndpoints,
    watchEndpoints,
    context,
    selectedNamespaces
  );
  const { handleCreateResource } = useCreateK8sResource<V1Endpoints>(createEndpoints, context);
  const { handleUpdateResource } = useUpdateK8sResource<V1Endpoints>(updateEndpoints, context);
  const { handleDeleteResources } = useDeleteK8sResources<V1Endpoints>(deleteEndpoints, context);

  const handleDelete = useCallback(
    async (eps: V1Endpoints[]) => {
      if (eps.length === 0) {
        toast.error('No Endpoints selected');
        return;
      }
      await handleDeleteResources(eps);
    },
    [handleDeleteResources]
  );

  return (
    <PaneEndpoints
      selectedNamespaces={selectedNamespaces}
      onSelectNamespace={setSelectedNamespaces}
      namespaceList={namespaceList}
      items={items}
      loading={loading}
      error={error ?? ''}
      onDeleteEndpoints={handleDelete}
      onCreate={handleCreateResource}
      onUpdate={handleUpdateResource}
      contextName={context?.name}
    />
  );
}
