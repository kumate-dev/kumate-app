import { useState, useCallback } from 'react';
import { V1Pod } from '@kubernetes/client-node';
import { PaneK8sResource, PaneK8sResourceContextProps } from './PaneK8sResource';
import { useNamespaceStore } from '@/store/namespaceStore';
import { useSelectedNamespaces } from '@/hooks/useSelectedNamespaces';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import { listPods, watchPods, deletePods } from '@/api/k8s/pods';
import { ColumnDef, TableHeader } from './TableHeader';
import { Td } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import AgeCell from '@/components/custom/AgeCell';
import { AlertTriangle } from 'lucide-react';
import { BadgeVariant } from '@/types/variant';
import { useFilteredItems } from '@/hooks/useFilteredItems';
import { BadgeK8sNamespaces } from './BadgeK8sNamespaces';
import { useDeleteK8sResources } from '@/hooks/useDeleteK8sResources';
import { toast } from 'sonner';

export default function PanePods({ context }: PaneK8sResourceContextProps) {
  const selectedNamespaces = useNamespaceStore((s) => s.selectedNamespaces);
  const setSelectedNamespaces = useNamespaceStore((s) => s.setSelectedNamespaces);
  const namespaceList = useSelectedNamespaces(context);

  const { items, loading, error } = useListK8sResources<V1Pod>(
    listPods,
    watchPods,
    context,
    selectedNamespaces
  );

  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState<keyof V1Pod>('metadata');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedPods, setSelectedPods] = useState<V1Pod[]>([]);

  const filtered = useFilteredItems(
    items,
    selectedNamespaces,
    q,
    ['metadata.name', 'metadata.namespace'],
    'metadata.name',
    'asc'
  );

  const { handleDeleteResources } = useDeleteK8sResources<V1Pod>(deletePods, context);

  const togglePod = useCallback((pod: V1Pod) => {
    setSelectedPods((prev) =>
      prev.includes(pod) ? prev.filter((p) => p !== pod) : [...prev, pod]
    );
  }, []);

  const toggleAllPods = useCallback(
    (checked: boolean) => {
      setSelectedPods(checked ? [...filtered] : []);
    },
    [filtered]
  );

  const handleDeleteSelected = useCallback(async () => {
    if (selectedPods.length === 0) return toast.error('No pods selected');
    await handleDeleteResources(selectedPods);
    setSelectedPods([]);
  }, [selectedPods, handleDeleteResources]);

  const columns: ColumnDef<keyof V1Pod | ''>[] = [
    { label: 'Name', key: 'metadata' },
    { label: '', key: '', sortable: false },
    { label: 'Namespace', key: 'metadata' },
    { label: 'Containers', key: 'spec' },
    { label: 'CPU', key: 'spec' },
    { label: 'Memory', key: 'spec' },
    { label: 'Restart', key: 'status' },
    { label: 'Controlled By', key: 'metadata' },
    { label: 'Node', key: 'spec' },
    { label: 'QoS', key: 'status' },
    { label: 'Age', key: 'metadata' },
    { label: 'Status', key: 'status' },
  ];

  const tableHeader = (
    <TableHeader
      columns={columns}
      sortBy={sortBy}
      sortOrder={sortOrder}
      setSortBy={setSortBy}
      setSortOrder={setSortOrder}
      onToggleAll={toggleAllPods}
      selectedItems={selectedPods}
      totalItems={filtered}
    />
  );

  const dotClass = (s?: string) => {
    switch (s) {
      case 'Running':
        return 'bg-green-500';
      case 'Failed':
        return 'bg-red-500';
      case 'Terminated':
      case 'Completed':
        return 'bg-gray-500';
      default:
        return 'bg-yellow-500';
    }
  };

  const podStatusVariant = (s: string): BadgeVariant => {
    switch (s) {
      case 'Pending':
      case 'ContainerCreating':
        return 'warning';
      case 'Running':
        return 'success';
      case 'Failed':
      case 'CrashLoopBackOff':
      case 'ImagePullBackOff':
      case 'ErrImagePull':
      case 'OOMKilled':
        return 'error';
      case 'Succeeded':
      case 'Terminating':
      default:
        return 'default';
    }
  };

  const hasPodWarning = (p: V1Pod): boolean => {
    const phase = p.status?.phase ?? 'Unknown';
    if (['Failed', 'Unknown'].includes(phase)) return true;

    const badStates = [
      'CrashLoopBackOff',
      'ErrImagePull',
      'ImagePullBackOff',
      'CreateContainerConfigError',
      'CreateContainerError',
      'InvalidImageName',
      'RunContainerError',
      'OOMKilled',
      'Error',
      'ContainerCannotRun',
      'DeadlineExceeded',
    ];

    return (
      p.status?.containerStatuses?.some((st) =>
        badStates.includes(st.state?.waiting?.reason || st.state?.terminated?.reason || '')
      ) ?? false
    );
  };

  const renderRow = (pod: V1Pod) => (
    <>
      <Td className="max-w-truncate align-middle">
        <span className="block truncate" title={pod.metadata?.name ?? ''}>
          {pod.metadata?.name}
        </span>
      </Td>
      <Td className="text-center align-middle">
        {hasPodWarning(pod) && <AlertTriangle className="inline-block h-4 w-4 text-yellow-400" />}
      </Td>
      <Td>
        <BadgeK8sNamespaces name={pod.metadata?.namespace ?? ''} />
      </Td>
      <Td className="align-middle">
        <div className="inline-flex items-center gap-1">
          {pod.status?.containerStatuses?.length
            ? pod.status.containerStatuses.map((st, idx) => (
                <span
                  key={idx}
                  className={`h-2.5 w-2.5 rounded-full ${dotClass(
                    st.state?.waiting?.reason || st.state?.terminated?.reason
                  )}`}
                />
              ))
            : Array.from({ length: pod.spec?.containers?.length || 0 }).map((_, idx) => (
                <span key={idx} className="h-2.5 w-2.5 rounded-full bg-white/30" />
              ))}
        </div>
      </Td>
      <Td>{pod.spec?.containers?.map((c) => c.resources?.requests?.cpu).join(', ') || '-'}</Td>
      <Td>{pod.spec?.containers?.map((c) => c.resources?.requests?.memory).join(', ') || '-'}</Td>
      <Td>
        {pod.status?.containerStatuses?.reduce((acc, s) => acc + (s.restartCount || 0), 0) ?? '-'}
      </Td>
      <Td>{pod.metadata?.ownerReferences?.map((o) => o.name).join(', ') || '-'}</Td>
      <Td>{pod.spec?.nodeName || '-'}</Td>
      <Td>{pod.status?.qosClass || '-'}</Td>
      <AgeCell timestamp={pod.metadata?.creationTimestamp} />
      <Td>
        <Badge variant={podStatusVariant(pod.status?.phase ?? '')}>{pod.status?.phase ?? ''}</Badge>
      </Td>
    </>
  );

  return (
    <PaneK8sResource
      items={filtered}
      loading={loading}
      error={error ?? ''}
      query={q}
      onQueryChange={setQ}
      namespaceList={namespaceList}
      selectedNamespaces={selectedNamespaces}
      onSelectNamespace={setSelectedNamespaces}
      selectedItems={selectedPods}
      onToggleItem={togglePod}
      onDeleteSelected={handleDeleteSelected}
      colSpan={columns.length + 1}
      tableHeader={tableHeader}
      renderRow={renderRow}
    />
  );
}
