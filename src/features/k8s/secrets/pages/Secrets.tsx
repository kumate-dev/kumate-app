import { useCallback } from 'react';
import { V1Secret } from '@kubernetes/client-node';
import { useNamespaceStore } from '@/store/namespaceStore';
import { useSelectedNamespaces } from '@/hooks/useSelectedNamespaces';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import {
  listSecrets,
  watchSecrets,
  deleteSecrets,
  createSecret,
  updateSecret,
} from '@/api/k8s/secrets';
import { useDeleteK8sResources } from '@/hooks/useDeleteK8sResources';
import { toast } from 'sonner';
import PaneSecrets from '../components/PaneSecrets';
import { PaneResourceContextProps } from '../../generic/components/PaneGeneric';
import { useCreateK8sResource } from '@/hooks/useCreateK8sResource';
import { useUpdateK8sResource } from '@/hooks/useUpdateK8sResource';

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

  const { handleCreateResource, creating } = useCreateK8sResource<V1Secret>(createSecret, context);
  const { handleUpdateResource, updating } = useUpdateK8sResource<V1Secret>(updateSecret, context);
  const { handleDeleteResources, deleting } = useDeleteK8sResources<V1Secret>(
    deleteSecrets,
    context
  );

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

  const handleCreateSecret = useCallback(
    async (manifest: V1Secret): Promise<V1Secret | undefined> => {
      try {
        const result = await handleCreateResource(manifest);
        return result || undefined;
      } catch (error) {
        console.error('Failed to create secret:', error);
        return undefined;
      }
    },
    [handleCreateResource]
  );

  const handleUpdateSecret = useCallback(
    async (manifest: V1Secret): Promise<V1Secret | undefined> => {
      try {
        const result = await handleUpdateResource(manifest);
        return result || undefined;
      } catch (error) {
        console.error('Failed to update secret:', error);
        return undefined;
      }
    },
    [handleUpdateResource]
  );

  return (
    <PaneSecrets
      selectedNamespaces={selectedNamespaces}
      onSelectNamespace={setSelectedNamespaces}
      namespaceList={namespaceList}
      items={items}
      loading={loading}
      error={error ?? ''}
      onDelete={handleDeleteSecrets}
      onCreate={handleCreateSecret}
      onUpdate={handleUpdateSecret}
      contextName={context?.name}
      creating={creating}
      updating={updating}
      deleting={deleting}
    />
  );
}
