import { useCallback } from 'react';
import { V1Namespace } from '@kubernetes/client-node';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import {
  listNamespaces,
  watchNamespaces,
  deleteNamespaces,
  createNamespace,
  updateNamespace,
} from '@/api/k8s/namespaces';
import PaneNamespaces from '../components/PaneNamespaces';
import { PaneResourceContextProps } from '../../generic/components/PaneGeneric';
import { useDeleteK8sResources } from '@/hooks/useDeleteK8sResources';
import { toast } from 'sonner';
import { useCreateK8sResource } from '@/hooks/useCreateK8sResource';
import { useUpdateK8sResource } from '@/hooks/useUpdateK8sResource';
import { useNamespaceStore } from '@/store/namespaceStore';
import { ALL_NAMESPACES } from '@/constants/k8s';

export default function Namespaces({ context }: PaneResourceContextProps) {
  const { items, loading, error } = useListK8sResources<V1Namespace>(
    listNamespaces,
    watchNamespaces,
    context
  );
  const { handleDeleteResources, deleting } = useDeleteK8sResources<V1Namespace>(
    deleteNamespaces,
    context
  );

  const { handleCreateResource, creating } = useCreateK8sResource<V1Namespace>(
    createNamespace,
    context
  );
  const { handleUpdateResource, updating } = useUpdateK8sResource<V1Namespace>(
    updateNamespace,
    context
  );

  const setNamespaces = useNamespaceStore((s) => s.setNamespaces);
  const selectedNamespaces = useNamespaceStore((s) => s.selectedNamespaces);
  const setSelectedNamespaces = useNamespaceStore((s) => s.setSelectedNamespaces);

  const handleDeleteNamespaces = useCallback(
    async (namespaces: V1Namespace[]) => {
      if (namespaces.length === 0) {
        toast.error('No Namespaces selected');
        return;
      }
      await handleDeleteResources(namespaces);

      const deletedNames = new Set(
        namespaces.map((ns) => ns.metadata?.name || '').filter((n) => !!n)
      );
      const remaining = (items || [])
        .filter((ns) => !deletedNames.has(ns.metadata?.name || ''))
        .map((ns) => ({ ...ns, _name: ns.metadata?.name || '' }))
        .sort((a, b) => a._name.localeCompare(b._name));
      setNamespaces(context?.name || null, remaining);

      const nextSelected = (selectedNamespaces || []).filter((n) => !deletedNames.has(n));
      setSelectedNamespaces(nextSelected.length ? nextSelected : [ALL_NAMESPACES]);
    },
    [
      handleDeleteResources,
      items,
      setNamespaces,
      context?.name,
      selectedNamespaces,
      setSelectedNamespaces,
    ]
  );

  const handleCreateNamespace = useCallback(
    async (manifest: V1Namespace): Promise<V1Namespace | undefined> => {
      const result = await handleCreateResource(manifest);
      if (result) {
        const merged = [...(items || []), result]
          .map((ns) => ({ ...ns, _name: ns.metadata?.name || '' }))
          .sort((a, b) => a._name.localeCompare(b._name));
        setNamespaces(context?.name || null, merged);
      }
      return result || undefined;
    },
    [handleCreateResource, items, setNamespaces, context?.name]
  );

  return (
    <PaneNamespaces
      items={items}
      loading={loading}
      error={error ?? ''}
      onDelete={handleDeleteNamespaces}
      contextName={context?.name}
      deleting={deleting}
      onCreate={handleCreateNamespace}
      onUpdate={handleUpdateResource}
      creating={creating}
      updating={updating}
    />
  );
}
