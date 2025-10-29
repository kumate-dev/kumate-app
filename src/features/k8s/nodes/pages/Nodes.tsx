import { V1Node } from '@kubernetes/client-node';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import { listNodes, watchNodes } from '@/api/k8s/nodes';
import PaneNodes from '../components/PaneNodes';
import { PaneResourceContextProps } from '../../common/components/PaneGeneric';

export default function Nodes({ context }: PaneResourceContextProps) {
  const { items, loading, error } = useListK8sResources<V1Node>(listNodes, watchNodes, context);

  return <PaneNodes items={items} loading={loading} error={error ?? ''} />;
}
