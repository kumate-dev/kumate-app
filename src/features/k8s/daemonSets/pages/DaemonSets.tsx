import { useCallback } from 'react';
import { V1DaemonSet } from '@kubernetes/client-node';
import { useNamespaceStore } from '@/store/namespaceStore';
import { useSelectedNamespaces } from '@/hooks/useSelectedNamespaces';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import {
  listDaemonSets,
  watchDaemonSets,
  deleteDaemonSets,
  createDaemonSet,
  updateDaemonSet,
} from '@/api/k8s/daemonSets';
import { useDeleteK8sResources } from '@/hooks/useDeleteK8sResources';
import { toast } from 'sonner';
import PaneDaemonSets from '../components/PaneDaemonSets';
import { PaneResourceContextProps } from '../../generic/components/PaneGeneric';
import { useCreateK8sResource } from '@/hooks/useCreateK8sResource';
import { useUpdateK8sResource } from '@/hooks/useUpdateK8sResource';

export default function DaemonSets({ context }: PaneResourceContextProps) {
  const selectedNamespaces = useNamespaceStore((s) => s.selectedNamespaces);
  const setSelectedNamespaces = useNamespaceStore((s) => s.setSelectedNamespaces);

  const namespaceList = useSelectedNamespaces(context);

  const { items, loading, error } = useListK8sResources<V1DaemonSet>(
    listDaemonSets,
    watchDaemonSets,
    context,
    selectedNamespaces
  );
  const { handleCreateResource } = useCreateK8sResource<V1DaemonSet>(createDaemonSet, context);
  const { handleUpdateResource } = useUpdateK8sResource<V1DaemonSet>(updateDaemonSet, context);
  const { handleDeleteResources } = useDeleteK8sResources<V1DaemonSet>(deleteDaemonSets, context);

  const handleDeleteDaemonSets = useCallback(
    async (daemonSets: V1DaemonSet[]) => {
      if (daemonSets.length === 0) {
        toast.error('No DaemonSets selected');
        return;
      }
      await handleDeleteResources(daemonSets);
    },
    [handleDeleteResources]
  );

  return (
    <PaneDaemonSets
      selectedNamespaces={selectedNamespaces}
      onSelectNamespace={setSelectedNamespaces}
      namespaceList={namespaceList}
      items={items}
      loading={loading}
      error={error ?? ''}
      onDeleteDaemonSets={handleDeleteDaemonSets}
      onCreate={handleCreateResource}
      onUpdate={handleUpdateResource}
      contextName={context?.name}
    />
  );
}
