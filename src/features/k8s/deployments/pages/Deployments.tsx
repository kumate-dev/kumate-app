import { useCallback } from 'react';
import { V1Deployment } from '@kubernetes/client-node';
import { useNamespaceStore } from '@/store/namespaceStore';
import { useSelectedNamespaces } from '@/hooks/useSelectedNamespaces';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import { listDeployments, watchDeployments, deleteDeployments } from '@/api/k8s/deployments';
import { useDeleteK8sResources } from '@/hooks/useDeleteK8sResources';
import { toast } from 'sonner';
import PaneDeployments from '../components/PaneDeployments';
import { PaneResourceContextProps } from '../../common/components/PaneGeneric';

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
      onDeleteDeployments={handleDeleteDeployments}
    />
  );
}
