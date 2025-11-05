import { useCallback } from 'react';
import type { V1PersistentVolume } from '@kubernetes/client-node';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import {
  listPersistentVolumes,
  watchPersistentVolumes,
  deletePersistentVolumes,
  createPersistentVolume,
  updatePersistentVolume,
} from '@/api/k8s/persistentVolumes';
import { useDeleteK8sResources } from '@/hooks/useDeleteK8sResources';
import { useCreateK8sResource } from '@/hooks/useCreateK8sResource';
import { useUpdateK8sResource } from '@/hooks/useUpdateK8sResource';
import { toast } from 'sonner';
import PanePersistentVolumes from '../components/PanePersistentVolumes';
import { PaneResourceContextProps } from '../../generic/components/PaneGeneric';

export default function PersistentVolumes({ context }: PaneResourceContextProps) {
  const { items, loading, error } = useListK8sResources<V1PersistentVolume>(
    listPersistentVolumes,
    watchPersistentVolumes,
    context
  );

  const { handleDeleteResources } = useDeleteK8sResources<V1PersistentVolume>(
    deletePersistentVolumes,
    context
  );

  const { handleCreateResource } = useCreateK8sResource<V1PersistentVolume>(
    createPersistentVolume,
    context
  );

  const { handleUpdateResource } = useUpdateK8sResource<V1PersistentVolume>(
    updatePersistentVolume,
    context
  );

  const onDelete = useCallback(
    async (selected: V1PersistentVolume[]) => {
      if (selected.length === 0) {
        toast.error('No PersistentVolumes selected');
        return;
      }
      await handleDeleteResources(selected);
    },
    [handleDeleteResources]
  );

  const onCreate = useCallback(
    (manifest: V1PersistentVolume) => handleCreateResource(manifest),
    [handleCreateResource]
  );

  const onUpdate = useCallback(
    (manifest: V1PersistentVolume) => handleUpdateResource(manifest),
    [handleUpdateResource]
  );

  return (
    <PanePersistentVolumes
      items={items}
      loading={loading}
      error={error}
      onDeletePersistentVolumes={onDelete}
      onCreate={onCreate}
      onUpdate={onUpdate}
      contextName={context?.name}
    />
  );
}
