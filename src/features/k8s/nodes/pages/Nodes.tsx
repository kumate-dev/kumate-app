import { useCallback } from 'react';
import { V1Node } from '@kubernetes/client-node';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import { listNodes, watchNodes, deleteNodes } from '@/api/k8s/nodes';
import PaneNodes from '../components/PaneNodes';
import { PaneResourceContextProps } from '../../generic/components/PaneGeneric';
import { useDeleteK8sResources } from '@/hooks/useDeleteK8sResources';
import { toast } from 'sonner';

export default function Nodes({ context }: PaneResourceContextProps) {
  const { items, loading, error } = useListK8sResources<V1Node>(listNodes, watchNodes, context);
  const { handleDeleteResources, deleting } = useDeleteK8sResources<V1Node>(deleteNodes, context);

  const handleDeleteNodes = useCallback(
    async (nodes: V1Node[]) => {
      if (nodes.length === 0) {
        toast.error('No Nodes selected');
        return;
      }
      await handleDeleteResources(nodes);
    },
    [handleDeleteResources]
  );

  return (
    <PaneNodes
      items={items}
      loading={loading}
      error={error ?? ''}
      onDeleteNodes={handleDeleteNodes}
      contextName={context?.name}
      deleting={deleting}
    />
  );
}
