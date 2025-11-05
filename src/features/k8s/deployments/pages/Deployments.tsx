import { useCallback } from 'react';
import { V1Deployment } from '@kubernetes/client-node';
import { useNamespaceStore } from '@/store/namespaceStore';
import { useSelectedNamespaces } from '@/hooks/useSelectedNamespaces';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import {
  listDeployments,
  watchDeployments,
  deleteDeployments,
  createDeployment,
  updateDeployment,
} from '@/api/k8s/deployments';
import { useDeleteK8sResources } from '@/hooks/useDeleteK8sResources';
import PaneDeployments from '../components/PaneDeployments';
import { PaneResourceContextProps } from '../../generic/components/PaneGeneric';
import { useCreateK8sResource } from '@/hooks/useCreateK8sResource';
import { useUpdateK8sResource } from '@/hooks/useUpdateK8sResource';
import { toast } from 'sonner';

export default function Deployments({ context }: PaneResourceContextProps) {
  const selectedNamespaces = useNamespaceStore((s) => s.selectedNamespaces);
  const setSelectedNamespaces = useNamespaceStore((s) => s.setSelectedNamespaces);

  const namespaceList = useSelectedNamespaces(context);

  const { items, loading, error } = useListK8sResources<V1Deployment>(
    listDeployments,
    watchDeployments,
    context,
    selectedNamespaces
  );
  const { handleCreateResource } = useCreateK8sResource<V1Deployment>(createDeployment, context);
  const { handleUpdateResource } = useUpdateK8sResource<V1Deployment>(updateDeployment, context);
  const { handleDeleteResources } = useDeleteK8sResources<V1Deployment>(deleteDeployments, context);

  const handleDeleteDeployments = useCallback(
    async (deployments: V1Deployment[]) => {
      if (deployments.length === 0) {
        toast.error('No deployments selected');
        return;
      }
      await handleDeleteResources(deployments);
    },
    [handleDeleteResources]
  );

  return (
    <PaneDeployments
      selectedNamespaces={selectedNamespaces}
      onSelectNamespace={setSelectedNamespaces}
      namespaceList={namespaceList}
      items={items}
      loading={loading}
      error={error ?? ''}
      onDelete={handleDeleteDeployments}
      onCreate={handleCreateResource}
      onUpdate={handleUpdateResource}
      contextName={context?.name}
    />
  );
}
