import { useCallback } from 'react';
import { V1Secret } from '@kubernetes/client-node';
import { useNamespaceStore } from '@/store/namespaceStore';
import { useSelectedNamespaces } from '@/hooks/useSelectedNamespaces';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import { listSecrets, watchSecrets, deleteSecrets } from '@/api/k8s/secrets';
import { useDeleteK8sResources } from '@/hooks/useDeleteK8sResources';
import { toast } from 'sonner';
import PaneSecrets from '../components/PaneSecrets';
import { PaneResourceContextProps } from '../../common/components/PaneGeneric';

export default function Secrets({ context }: PaneResourceContextProps) {
  const selectedNamespaces = useNamespaceStore((s) => s.selectedNamespaces);
  const setSelectedNamespaces = useNamespaceStore((s) => s.setSelectedNamespaces);

  const namespaceList = useSelectedNamespaces(context);

  const { items, loading, error } = useListK8sResources<V1Secret>(
    listSecrets,
    watchSecrets,
    context,
    selectedNamespaces
  );

  const { handleDeleteResources } = useDeleteK8sResources<V1Secret>(deleteSecrets, context);

  const handleDeleteSecrets = useCallback(
    async (secrets: V1Secret[]) => {
      if (secrets.length === 0) {
        toast.error('No Secrets selected');
        return;
      }
      await handleDeleteResources(secrets);
    },
    [handleDeleteResources]
  );

  return (
    <PaneSecrets
      selectedNamespaces={selectedNamespaces}
      onSelectNamespace={setSelectedNamespaces}
      namespaceList={namespaceList}
      items={items}
      loading={loading}
      error={error ?? ''}
      onDeleteSecrets={handleDeleteSecrets}
    />
  );
}
