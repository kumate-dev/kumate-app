import { useCallback } from 'react';
import { V1CronJob } from '@kubernetes/client-node';
import { useNamespaceStore } from '@/store/namespaceStore';
import { useSelectedNamespaces } from '@/hooks/useSelectedNamespaces';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import { listCronJobs, watchCronJobs, deleteCronJobs } from '@/api/k8s/cronJobs';
import { useDeleteK8sResources } from '@/hooks/useDeleteK8sResources';
import { toast } from 'sonner';
import PaneCronJobs from '../components/PaneCronJobs';
import { PaneResourceContextProps } from '../../common/components/PaneGeneric';

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

  const { handleDeleteResources } = useDeleteK8sResources<V1CronJob>(deleteCronJobs, context);

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

  return (
    <PaneCronJobs
      selectedNamespaces={selectedNamespaces}
      onSelectNamespace={setSelectedNamespaces}
      namespaceList={namespaceList}
      items={items}
      loading={loading}
      error={error ?? ''}
      onDeleteCronJobs={handleDeleteCronJobs}
    />
  );
}
