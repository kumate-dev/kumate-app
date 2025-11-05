import { useCallback } from 'react';
import { V1ConfigMap } from '@kubernetes/client-node';
import { useNamespaceStore } from '@/store/namespaceStore';
import { useSelectedNamespaces } from '@/hooks/useSelectedNamespaces';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import {
  listConfigMaps,
  watchConfigMaps,
  deleteConfigMaps,
  createConfigMap,
  updateConfigMap,
} from '@/api/k8s/configMaps';
import { useDeleteK8sResources } from '@/hooks/useDeleteK8sResources';
import { toast } from 'sonner';
import PaneConfigMaps from '../components/PaneConfigMaps';
import { PaneResourceContextProps } from '../../generic/components/PaneGeneric';
import { useCreateK8sResource } from '@/hooks/useCreateK8sResource';
import { useUpdateK8sResource } from '@/hooks/useUpdateK8sResource';

export default function ConfigMaps({ context }: PaneResourceContextProps) {
  const selectedNamespaces = useNamespaceStore((s) => s.selectedNamespaces);
  const setSelectedNamespaces = useNamespaceStore((s) => s.setSelectedNamespaces);

  const namespaceList = useSelectedNamespaces(context);

  const { items, loading, error } = useListK8sResources<V1ConfigMap>(
    listConfigMaps,
    watchConfigMaps,
    context,
    selectedNamespaces
  );
  const { handleCreateResource } = useCreateK8sResource<V1ConfigMap>(createConfigMap, context);
  const { handleUpdateResource } = useUpdateK8sResource<V1ConfigMap>(updateConfigMap, context);
  const { handleDeleteResources } = useDeleteK8sResources<V1ConfigMap>(deleteConfigMaps, context);

  const handleDeleteConfigMaps = useCallback(
    async (configMaps: V1ConfigMap[]) => {
      if (configMaps.length === 0) {
        toast.error('No ConfigMaps selected');
        return;
      }
      await handleDeleteResources(configMaps);
    },
    [handleDeleteResources]
  );

  return (
    <PaneConfigMaps
      selectedNamespaces={selectedNamespaces}
      onSelectNamespace={setSelectedNamespaces}
      namespaceList={namespaceList}
      items={items}
      loading={loading}
      error={error ?? ''}
      onDeleteConfigMaps={handleDeleteConfigMaps}
      onCreate={handleCreateResource}
      onUpdate={handleUpdateResource}
      contextName={context?.name}
    />
  );
}
