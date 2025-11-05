import { useCallback } from 'react';
import { V1PersistentVolumeClaim } from '@kubernetes/client-node';
import { useNamespaceStore } from '@/store/namespaceStore';
import { useSelectedNamespaces } from '@/hooks/useSelectedNamespaces';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import {
  listPersistentVolumeClaims,
  watchPersistentVolumeClaims,
  deletePersistentVolumeClaims,
  createPersistentVolumeClaim,
  updatePersistentVolumeClaim,
} from '@/api/k8s/persistentVolumeClaims';
import { useDeleteK8sResources } from '@/hooks/useDeleteK8sResources';
import { toast } from 'sonner';
import PanePersistentVolumeClaims from '../components/PanePersistentVolumeClaims';
import { PaneResourceContextProps } from '../../generic/components/PaneGeneric';
import { useCreateK8sResource } from '@/hooks/useCreateK8sResource';
import { useUpdateK8sResource } from '@/hooks/useUpdateK8sResource';

export default function PersistentVolumeClaims({ context }: PaneResourceContextProps) {
  const selectedNamespaces = useNamespaceStore((s) => s.selectedNamespaces);
  const setSelectedNamespaces = useNamespaceStore((s) => s.setSelectedNamespaces);

  const namespaceList = useSelectedNamespaces(context);

  const { items, loading, error } = useListK8sResources<V1PersistentVolumeClaim>(
    listPersistentVolumeClaims,
    watchPersistentVolumeClaims,
    context,
    selectedNamespaces
  );

  const { handleCreateResource } = useCreateK8sResource<V1PersistentVolumeClaim>(
    createPersistentVolumeClaim,
    context
  );
  const { handleUpdateResource } = useUpdateK8sResource<V1PersistentVolumeClaim>(
    updatePersistentVolumeClaim,
    context
  );
  const { handleDeleteResources } = useDeleteK8sResources<V1PersistentVolumeClaim>(
    deletePersistentVolumeClaims,
    context
  );

  const handleDeletePersistentVolumeClaims = useCallback(
    async (pvcs: V1PersistentVolumeClaim[]) => {
      if (pvcs.length === 0) {
        toast.error('No PersistentVolumeClaims selected');
        return;
      }
      await handleDeleteResources(pvcs);
    },
    [handleDeleteResources]
  );

  return (
    <PanePersistentVolumeClaims
      selectedNamespaces={selectedNamespaces}
      onSelectNamespace={setSelectedNamespaces}
      namespaceList={namespaceList}
      items={items}
      loading={loading}
      error={error ?? ''}
      onDeletePersistentVolumeClaims={handleDeletePersistentVolumeClaims}
      onCreate={handleCreateResource}
      onUpdate={handleUpdateResource}
      contextName={context?.name}
    />
  );
}
