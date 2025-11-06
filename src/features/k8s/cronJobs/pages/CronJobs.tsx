import { useCallback } from 'react';
import { V1CronJob } from '@kubernetes/client-node';
import { useNamespaceStore } from '@/store/namespaceStore';
import { useSelectedNamespaces } from '@/hooks/useSelectedNamespaces';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import {
  listCronJobs,
  watchCronJobs,
  deleteCronJobs,
  createCronJob,
  updateCronJob,
} from '@/api/k8s/cronJobs';
import { useDeleteK8sResources } from '@/hooks/useDeleteK8sResources';
import { toast } from 'sonner';
import PaneCronJobs from '../components/PaneCronJobs';
import { PaneResourceContextProps } from '../../generic/components/PaneGeneric';
import { useCreateK8sResource } from '@/hooks/useCreateK8sResource';
import { useUpdateK8sResource } from '@/hooks/useUpdateK8sResource';

export default function CronJobs({ context }: PaneResourceContextProps) {
  const selectedNamespaces = useNamespaceStore((s) => s.selectedNamespaces);
  const setSelectedNamespaces = useNamespaceStore((s) => s.setSelectedNamespaces);

  const namespaceList = useSelectedNamespaces(context);

  const { items, loading, error } = useListK8sResources<V1CronJob>(
    listCronJobs,
    watchCronJobs,
    context,
    selectedNamespaces
  );
  const { handleCreateResource, creating: creatingCronJob } = useCreateK8sResource<V1CronJob>(
    createCronJob,
    context
  );
  const { handleUpdateResource, updating: updatingCronJob } = useUpdateK8sResource<V1CronJob>(
    updateCronJob,
    context
  );
  const { handleDeleteResources, deleting: deletingCronJobs } = useDeleteK8sResources<V1CronJob>(
    deleteCronJobs,
    context
  );

  const handleDeleteCronJobs = useCallback(
    async (cronJobs: V1CronJob[]) => {
      if (cronJobs.length === 0) {
        toast.error('No CronJobs selected');
        return;
      }
      await handleDeleteResources(cronJobs);
    },
    [handleDeleteResources]
  );

  const handleCreateCronJob = useCallback(
    async (manifest: V1CronJob): Promise<V1CronJob | undefined> => {
      try {
        const result = await handleCreateResource(manifest);
        return result || undefined;
      } catch (error) {
        console.error('Failed to create cronjob:', error);
        return undefined;
      }
    },
    [handleCreateResource]
  );

  const handleUpdateCronJob = useCallback(
    async (manifest: V1CronJob): Promise<V1CronJob | undefined> => {
      try {
        const result = await handleUpdateResource(manifest);
        return result || undefined;
      } catch (error) {
        console.error('Failed to update cronjob:', error);
        return undefined;
      }
    },
    [handleUpdateResource]
  );

  return (
    <PaneCronJobs
      selectedNamespaces={selectedNamespaces}
      onSelectNamespace={setSelectedNamespaces}
      namespaceList={namespaceList}
      items={items}
      loading={loading}
      error={error ?? ''}
      onDelete={handleDeleteCronJobs}
      onCreate={handleCreateCronJob}
      onUpdate={handleUpdateCronJob}
      contextName={context?.name}
      creating={creatingCronJob}
      updating={updatingCronJob}
      deleting={deletingCronJobs}
    />
  );
}
