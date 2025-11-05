import { useCallback } from 'react';
import type { V1StorageClass } from '@kubernetes/client-node';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import {
  listStorageClasses,
  watchStorageClasses,
  deleteStorageClasses,
  createStorageClass,
  updateStorageClass,
} from '@/api/k8s/storageClasses';
import { useDeleteK8sResources } from '@/hooks/useDeleteK8sResources';
import { useCreateK8sResource } from '@/hooks/useCreateK8sResource';
import { useUpdateK8sResource } from '@/hooks/useUpdateK8sResource';
import { toast } from 'sonner';
import PaneStorageClasses from '../components/PaneStorageClasses';
import { PaneResourceContextProps } from '../../generic/components/PaneGeneric';

export default function StorageClasses({ context }: PaneResourceContextProps) {
  const { items, loading, error } = useListK8sResources<V1StorageClass>(
    listStorageClasses,
    watchStorageClasses,
    context
  );

  const { handleDeleteResources } = useDeleteK8sResources<V1StorageClass>(
    deleteStorageClasses,
    context
  );

  const { handleCreateResource } = useCreateK8sResource<V1StorageClass>(
    createStorageClass,
    context
  );

  const { handleUpdateResource } = useUpdateK8sResource<V1StorageClass>(
    updateStorageClass,
    context
  );

  const onDelete = useCallback(
    async (selected: V1StorageClass[]) => {
      if (selected.length === 0) {
        toast.error('No StorageClasses selected');
        return;
      }
      await handleDeleteResources(selected);
    },
    [handleDeleteResources]
  );

  const onCreate = useCallback(
    (manifest: V1StorageClass) => handleCreateResource(manifest),
    [handleCreateResource]
  );

  const onUpdate = useCallback(
    (manifest: V1StorageClass) => handleUpdateResource(manifest),
    [handleUpdateResource]
  );

  return (
    <PaneStorageClasses
      items={items}
      loading={loading}
      error={error}
      onDeleteStorageClasses={onDelete}
      onCreate={onCreate}
      onUpdate={onUpdate}
      contextName={context?.name}
    />
  );
}
