import { V1Namespace } from '@kubernetes/client-node';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import { listNamespaces, watchNamespaces } from '@/api/k8s/namespaces';
import PaneNamespaces from '../components/PaneNamespaces';
import { PaneResourceContextProps } from '../../common/components/PaneGeneric';

export default function Namespaces({ context }: PaneResourceContextProps) {
  const { items, loading, error } = useListK8sResources<V1Namespace>(
    listNamespaces,
    watchNamespaces,
    context
  );

  return <PaneNamespaces items={items} loading={loading} error={error ?? ''} />;
}
