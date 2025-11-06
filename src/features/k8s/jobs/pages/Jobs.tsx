import { useCallback } from 'react';
import { V1Job } from '@kubernetes/client-node';
import { useNamespaceStore } from '@/store/namespaceStore';
import { useSelectedNamespaces } from '@/hooks/useSelectedNamespaces';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import { listJobs, watchJobs, deleteJobs, createJob, updateJob } from '@/api/k8s/jobs';
import { useDeleteK8sResources } from '@/hooks/useDeleteK8sResources';
import { toast } from 'sonner';
import PaneJobs from '../components/PaneJobs';
import { PaneResourceContextProps } from '../../generic/components/PaneGeneric';
import { useCreateK8sResource } from '@/hooks/useCreateK8sResource';
import { useUpdateK8sResource } from '@/hooks/useUpdateK8sResource';

export default function Jobs({ context }: PaneResourceContextProps) {
  const selectedNamespaces = useNamespaceStore((s) => s.selectedNamespaces);
  const setSelectedNamespaces = useNamespaceStore((s) => s.setSelectedNamespaces);

  const namespaceList = useSelectedNamespaces(context);

  const { items, loading, error } = useListK8sResources<V1Job>(
    listJobs,
    watchJobs,
    context,
    selectedNamespaces
  );
  const { handleCreateResource, creating: creatingJob } = useCreateK8sResource<V1Job>(
    createJob,
    context
  );
  const { handleUpdateResource, updating: updatingJob } = useUpdateK8sResource<V1Job>(
    updateJob,
    context
  );
  const { handleDeleteResources, deleting: deletingJobs } = useDeleteK8sResources<V1Job>(
    deleteJobs,
    context
  );

  const handleDeleteJobs = useCallback(
    async (jobs: V1Job[]) => {
      if (jobs.length === 0) {
        toast.error('No jobs selected');
        return;
      }
      await handleDeleteResources(jobs);
    },
    [handleDeleteResources]
  );

  const handleCreateJob = useCallback(
    async (manifest: V1Job): Promise<V1Job | undefined> => {
      try {
        const result = await handleCreateResource(manifest);
        return result || undefined;
      } catch (error) {
        console.error('Failed to create job:', error);
        return undefined;
      }
    },
    [handleCreateResource]
  );

  const handleUpdateJob = useCallback(
    async (manifest: V1Job): Promise<V1Job | undefined> => {
      try {
        const result = await handleUpdateResource(manifest);
        return result || undefined;
      } catch (error) {
        console.error('Failed to update job:', error);
        return undefined;
      }
    },
    [handleUpdateResource]
  );

  return (
    <PaneJobs
      selectedNamespaces={selectedNamespaces}
      onSelectNamespace={setSelectedNamespaces}
      namespaceList={namespaceList}
      items={items}
      loading={loading}
      error={error ?? ''}
      onDelete={handleDeleteJobs}
      onCreate={handleCreateJob}
      onUpdate={handleUpdateJob}
      contextName={context?.name}
      creating={creatingJob}
      updating={updatingJob}
      deleting={deletingJobs}
    />
  );
}
