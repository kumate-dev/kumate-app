import { useCallback } from 'react';
import { V1PriorityClass } from '@kubernetes/client-node';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import {
  listPriorityClasses,
  watchPriorityClasses,
  deletePriorityClasses,
} from '@/api/k8s/priorityClasses';
import { useDeleteK8sResources } from '@/hooks/useDeleteK8sResources';
import { toast } from 'sonner';
import PanePriorityClasses from '../components/PanePriorityClasses';
import { PaneResourceContextProps } from '../../generic/components/PaneGeneric';
import { useCreateK8sResource } from '@/hooks/useCreateK8sResource';
import { useUpdateK8sResource } from '@/hooks/useUpdateK8sResource';
import { createPriorityClass, updatePriorityClass } from '@/api/k8s/priorityClasses';

export default function PriorityClasses({ context }: PaneResourceContextProps) {
  const { items, loading, error } = useListK8sResources<V1PriorityClass>(
    listPriorityClasses,
    watchPriorityClasses,
    context
  );

  const { handleDeleteResources } = useDeleteK8sResources<V1PriorityClass>(
    deletePriorityClasses,
    context
  );

  const { handleCreateResource } = useCreateK8sResource<V1PriorityClass>(
    createPriorityClass,
    context
  );
  const { handleUpdateResource } = useUpdateK8sResource<V1PriorityClass>(
    updatePriorityClass,
    context
  );

  const handleDeletePriorityClasses = useCallback(
    async (priorityClasses: V1PriorityClass[]) => {
      if (priorityClasses.length === 0) {
        toast.error('No PriorityClasses selected');
        return;
      }
      await handleDeleteResources(priorityClasses);
    },
    [handleDeleteResources]
  );

  return (
    <PanePriorityClasses
      items={items}
      loading={loading}
      error={error ?? ''}
      onDeletePriorityClasses={handleDeletePriorityClasses}
      onCreate={handleCreateResource}
      onUpdate={handleUpdateResource}
      contextName={context?.name}
    />
  );
}
