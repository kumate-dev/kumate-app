import { useCallback } from 'react';
import { V1IngressClass } from '@kubernetes/client-node';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import {
  listIngressClasses,
  watchIngressClasses,
  deleteIngressClasses,
  createIngressClass,
  updateIngressClass,
} from '@/api/k8s/ingressClasses';
import { useDeleteK8sResources } from '@/hooks/useDeleteK8sResources';
import { toast } from 'sonner';
import PaneIngressClasses from '../components/PaneIngressClasses';
import { PaneResourceContextProps } from '../../generic/components/PaneGeneric';
import { useCreateK8sResource } from '@/hooks/useCreateK8sResource';
import { useUpdateK8sResource } from '@/hooks/useUpdateK8sResource';

export default function IngressClasses({ context }: PaneResourceContextProps) {
  const { items, loading, error } = useListK8sResources<V1IngressClass>(
    listIngressClasses,
    watchIngressClasses,
    context
  );

  const { handleCreateResource, creating } = useCreateK8sResource<V1IngressClass>(
    createIngressClass,
    context
  );
  const { handleUpdateResource, updating } = useUpdateK8sResource<V1IngressClass>(
    updateIngressClass,
    context
  );
  const { handleDeleteResources, deleting } = useDeleteK8sResources<V1IngressClass>(
    deleteIngressClasses,
    context
  );

  const handleDelete = useCallback(
    async (items: V1IngressClass[]) => {
      if (items.length === 0) {
        toast.error('No IngressClass selected');
        return;
      }
      await handleDeleteResources(items);
    },
    [handleDeleteResources]
  );

  const handleCreateIngressClass = useCallback(
    async (manifest: V1IngressClass): Promise<V1IngressClass | undefined> => {
      try {
        const result = await handleCreateResource(manifest);
        return result || undefined;
      } catch (error) {
        console.error('Failed to create ingress class:', error);
        return undefined;
      }
    },
    [handleCreateResource]
  );

  const handleUpdateIngressClass = useCallback(
    async (manifest: V1IngressClass): Promise<V1IngressClass | undefined> => {
      try {
        const result = await handleUpdateResource(manifest);
        return result || undefined;
      } catch (error) {
        console.error('Failed to update ingress class:', error);
        return undefined;
      }
    },
    [handleUpdateResource]
  );

  return (
    <PaneIngressClasses
      items={items}
      loading={loading}
      error={error ?? ''}
      onDelete={handleDelete}
      onCreate={handleCreateIngressClass}
      onUpdate={handleUpdateIngressClass}
      contextName={context?.name}
      creating={creating}
      updating={updating}
      deleting={deleting}
    />
  );
}
