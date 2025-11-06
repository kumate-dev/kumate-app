import { useCallback } from 'react';
import type { V1ValidatingWebhookConfiguration } from '@kubernetes/client-node';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import { useCreateK8sResource } from '@/hooks/useCreateK8sResource';
import { useUpdateK8sResource } from '@/hooks/useUpdateK8sResource';
import { useDeleteK8sResources } from '@/hooks/useDeleteK8sResources';
import { PaneResourceContextProps } from '../../generic/components/PaneGeneric';
import {
  listValidatingWebhooks,
  watchValidatingWebhooks,
  createValidatingWebhook,
  updateValidatingWebhook,
  deleteValidatingWebhooks,
} from '@/api/k8s/validatingWebhooks';
import PaneValidatingWebhooks from '../components/PaneValidatingWebhooks';
import { toast } from 'sonner';

export default function ValidatingWebhooks({ context }: PaneResourceContextProps) {
  const { items, loading, error } = useListK8sResources<V1ValidatingWebhookConfiguration>(
    listValidatingWebhooks,
    watchValidatingWebhooks,
    context
  );

  const { handleCreateResource, creating } = useCreateK8sResource<V1ValidatingWebhookConfiguration>(
    createValidatingWebhook,
    context
  );
  const { handleUpdateResource, updating } = useUpdateK8sResource<V1ValidatingWebhookConfiguration>(
    updateValidatingWebhook,
    context
  );
  const { handleDeleteResources, deleting } =
    useDeleteK8sResources<V1ValidatingWebhookConfiguration>(deleteValidatingWebhooks, context);

  const handleDeleteItems = useCallback(
    async (itemsToDelete: V1ValidatingWebhookConfiguration[]) => {
      if (itemsToDelete.length === 0) {
        toast.error('No Validating Webhooks selected');
        return;
      }
      await handleDeleteResources(itemsToDelete);
    },
    [handleDeleteResources]
  );

  const handleCreateValidatingWebhook = useCallback(
    async (
      manifest: V1ValidatingWebhookConfiguration
    ): Promise<V1ValidatingWebhookConfiguration | undefined> => {
      try {
        const result = await handleCreateResource(manifest);
        return result || undefined;
      } catch (error) {
        console.error('Failed to create validating webhook configuration:', error);
        return undefined;
      }
    },
    [handleCreateResource]
  );

  const handleUpdateValidatingWebhook = useCallback(
    async (
      manifest: V1ValidatingWebhookConfiguration
    ): Promise<V1ValidatingWebhookConfiguration | undefined> => {
      try {
        const result = await handleUpdateResource(manifest);
        return result || undefined;
      } catch (error) {
        console.error('Failed to update validating webhook configuration:', error);
        return undefined;
      }
    },
    [handleUpdateResource]
  );

  return (
    <PaneValidatingWebhooks
      items={items}
      loading={loading}
      error={error ?? ''}
      onDelete={handleDeleteItems}
      onCreate={handleCreateValidatingWebhook}
      onUpdate={handleUpdateValidatingWebhook}
      contextName={context?.name}
      creating={creating}
      updating={updating}
      deleting={deleting}
    />
  );
}
