import { useCallback } from 'react';
import type { V1MutatingWebhookConfiguration } from '@kubernetes/client-node';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import { useCreateK8sResource } from '@/hooks/useCreateK8sResource';
import { useUpdateK8sResource } from '@/hooks/useUpdateK8sResource';
import { useDeleteK8sResources } from '@/hooks/useDeleteK8sResources';
import { PaneResourceContextProps } from '../../generic/components/PaneGeneric';
import {
  listMutatingWebhooks,
  watchMutatingWebhooks,
  createMutatingWebhook,
  updateMutatingWebhook,
  deleteMutatingWebhooks,
} from '@/api/k8s/mutatingWebhooks';
import PaneMutatingWebhooks from '../components/PaneMutatingWebhooks';
import { toast } from 'sonner';

export default function MutatingWebhooks({ context }: PaneResourceContextProps) {
  const { items, loading, error } = useListK8sResources<V1MutatingWebhookConfiguration>(
    listMutatingWebhooks,
    watchMutatingWebhooks,
    context
  );

  const { handleCreateResource } = useCreateK8sResource<V1MutatingWebhookConfiguration>(
    createMutatingWebhook,
    context
  );
  const { handleUpdateResource } = useUpdateK8sResource<V1MutatingWebhookConfiguration>(
    updateMutatingWebhook,
    context
  );
  const { handleDeleteResources } = useDeleteK8sResources<V1MutatingWebhookConfiguration>(
    deleteMutatingWebhooks,
    context
  );

  const handleDeleteItems = useCallback(
    async (itemsToDelete: V1MutatingWebhookConfiguration[]) => {
      if (itemsToDelete.length === 0) {
        toast.error('No Mutating Webhooks selected');
        return;
      }
      await handleDeleteResources(itemsToDelete);
    },
    [handleDeleteResources]
  );

  return (
    <PaneMutatingWebhooks
      items={items}
      loading={loading}
      error={error ?? ''}
      onDeleteItems={handleDeleteItems}
      onCreate={handleCreateResource}
      onUpdate={handleUpdateResource}
      contextName={context?.name}
    />
  );
}
