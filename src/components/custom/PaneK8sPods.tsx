import { useState, useCallback } from 'react';
import { PaneK8sResource, PaneK8sResourceContextProps } from './PaneK8sResource';
import { useNamespaceStore } from '@/state/namespaceStore';
import { useSelectedNamespaces } from '@/hooks/useSelectedNamespaces';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import { listPods, watchPods, PodItem, deletePods } from '@/services/pods';
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

  const { items, loading, error } = useListK8sResources<PodItem>(
    listPods,
    watchPods,
    context,
    selectedNamespaces
  );

  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState<keyof PodItem>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedPods, setSelectedPods] = useState<PodItem[]>([]);

  const filtered = useFilteredItems(
    items,
    selectedNamespaces,
    q,
    ['name', 'namespace'],
    sortBy,
    sortOrder
  );

  const { handleDeleteResources } = useDeleteK8sResources<PodItem>(deletePods, context);

  const togglePod = useCallback((pod: PodItem) => {
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

  const columns: ColumnDef<keyof PodItem | ''>[] = [
    { label: 'Name', key: 'name' },
    { label: '', key: '', sortable: false },
    { label: 'Namespace', key: 'namespace' },
    { label: 'Containers', key: 'containers' },
    { label: 'CPU', key: 'cpu' },
    { label: 'Memory', key: 'memory' },
    { label: 'Restart', key: 'restart' },
    { label: 'Node', key: 'node' },
    { label: 'QoS', key: 'qos' },
    { label: 'Age', key: 'creation_timestamp' },
    { label: 'Status', key: 'phase' },
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
      case 'Succeeded':
        return 'success';
      case 'Failed':
      case 'CrashLoopBackOff':
      case 'ImagePullBackOff':
      case 'ErrImagePull':
      case 'OOMKilled':
      case 'Terminating':
        return 'error';
      default:
        return 'default';
    }
  };

  const hasPodWarning = (p: PodItem): boolean => {
    const phase = p.phase ?? 'Unknown';
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

    return p.container_states?.some((st) => badStates.includes(st)) ?? false;
  };

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
      renderRow={(pod) => (
        <>
          <Td className="max-w-truncate align-middle">
            <span className="block truncate" title={pod.name}>
              {pod.name}
            </span>
          </Td>
          <Td className="text-center align-middle">
            {hasPodWarning(pod) && (
              <AlertTriangle className="inline-block h-4 w-4 text-yellow-400" />
            )}
          </Td>
          <Td>
            <BadgeK8sNamespaces name={pod.namespace} />
          </Td>
          <Td>
            <div className="flex items-center gap-1">
              {pod.container_states?.length
                ? pod.container_states.map((st, idx) => (
                    <span
                      key={idx}
                      className={`inline-block h-2.5 w-2.5 rounded-full ${dotClass(st)}`}
                    />
                  ))
                : Array.from({ length: pod.containers || 0 }).map((_, idx) => (
                    <span key={idx} className="inline-block h-2.5 w-2.5 rounded-full bg-white/30" />
                  ))}
            </div>
          </Td>
          <Td>{pod.cpu || '-'}</Td>
          <Td>{pod.memory || '-'}</Td>
          <Td>{pod.restart ?? '-'}</Td>
          <Td>{pod.node || '-'}</Td>
          <Td>{pod.qos || '-'}</Td>
          <AgeCell timestamp={pod.creation_timestamp || ''} />
          <Td>
            <Badge variant={podStatusVariant(pod.phase ?? '')}>{pod.phase ?? ''}</Badge>
          </Td>
        </>
      )}
    />
  );
}
