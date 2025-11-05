import { useCallback } from 'react';
import { V1RuntimeClass } from '@kubernetes/client-node';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import {
  listRuntimeClasses,
  watchRuntimeClasses,
  deleteRuntimeClasses,
} from '@/api/k8s/runtimeClasses';
import { useDeleteK8sResources } from '@/hooks/useDeleteK8sResources';
import { toast } from 'sonner';
import PaneRuntimeClasses from '../components/PaneRuntimeClasses';
import { PaneResourceContextProps } from '../../generic/components/PaneGeneric';
import { useCreateK8sResource } from '@/hooks/useCreateK8sResource';
import { useUpdateK8sResource } from '@/hooks/useUpdateK8sResource';
import { createRuntimeClass, updateRuntimeClass } from '@/api/k8s/runtimeClasses';

export default function RuntimeClasses({ context }: PaneResourceContextProps) {
  const { items, loading, error } = useListK8sResources<V1RuntimeClass>(
    listRuntimeClasses,
    watchRuntimeClasses,
    context
  );

  const { handleDeleteResources } = useDeleteK8sResources<V1RuntimeClass>(
    deleteRuntimeClasses,
    context
  );

  const { handleCreateResource } = useCreateK8sResource<V1RuntimeClass>(
    createRuntimeClass,
    context
  );
  const { handleUpdateResource } = useUpdateK8sResource<V1RuntimeClass>(
    updateRuntimeClass,
    context
  );

  const handleDeleteRuntimeClasses = useCallback(
    async (runtimeClasses: V1RuntimeClass[]) => {
      if (runtimeClasses.length === 0) {
        toast.error('No RuntimeClasses selected');
        return;
      }
      await handleDeleteResources(runtimeClasses);
    },
    [handleDeleteResources]
  );

  return (
    <PaneRuntimeClasses
      items={items}
      loading={loading}
      error={error ?? ''}
      onDeleteRuntimeClasses={handleDeleteRuntimeClasses}
      onCreate={handleCreateResource}
      onUpdate={handleUpdateResource}
      contextName={context?.name}
    />
  );
}
