import { useState } from 'react';
import { PaneK8sResource, PaneK8sResourceContextProps } from './PaneK8sResource';
import { useNamespaceStore } from '@/state/namespaceStore';
import { useSelectedNamespaces } from '@/hooks/useSelectedNamespaces';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import { listPods, watchPods, PodItem, deletePods } from '@/services/pods';
import { ColumnDef, TableHeader } from './TableHeader';
import { Td, Tr } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import AgeCell from '@/components/custom/AgeCell';
import { AlertTriangle, X } from 'lucide-react';
import { BadgeVariant } from '@/types/variant';
import { useFilteredItems } from '@/hooks/useFilteredItems';
import { BadgeK8sNamespaces } from './BadgeK8sNamespaces';
import { useDeleteK8sResources } from '@/hooks/useDeleteK8sResources';

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

  const filtered = useFilteredItems(
    items,
    selectedNamespaces,
    q,
    ['name', 'namespace'],
    sortBy,
    sortOrder
  );

  const dotClass = (s: string | undefined) => {
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

  const { handleDeleteResources } = useDeleteK8sResources<PodItem>(deletePods, context);

  const handleDeletePods = async (pods: PodItem[]) => {
    await handleDeleteResources(pods);
  };

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
    { label: '', key: '', sortable: false },
  ];

  const tableHeader = (
    <TableHeader
      columns={columns}
      sortBy={sortBy}
      sortOrder={sortOrder}
      setSortBy={setSortBy}
      setSortOrder={setSortOrder}
    />
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
      colSpan={columns.length}
      tableHeader={tableHeader}
      renderRow={(f) => (
        <Tr key={`${f.namespace}/${f.name}`}>
          <Td className="max-w-truncate">
            <span className="block truncate" title={f.name}>
              {f.name}
            </span>
          </Td>
          <Td className="text-center">
            {hasPodWarning(f) && <AlertTriangle className="inline-block h-4 w-4 text-yellow-400" />}
          </Td>
          <BadgeK8sNamespaces name={f.namespace} />
          <Td>
            <div className="flex items-center gap-1">
              {f.container_states?.length
                ? f.container_states.map((st, idx) => (
                    <span
                      key={idx}
                      className={`inline-block h-2.5 w-2.5 rounded-full ${dotClass(st)}`}
                    />
                  ))
                : Array.from({ length: f.containers || 0 }).map((_, idx) => (
                    <span key={idx} className="inline-block h-2.5 w-2.5 rounded-full bg-white/30" />
                  ))}
            </div>
          </Td>
          <Td>{f.cpu || '-'}</Td>
          <Td>{f.memory || '-'}</Td>
          <Td>{f.restart ?? '-'}</Td>
          <Td>{f.node || '-'}</Td>
          <Td>{f.qos || '-'}</Td>
          <AgeCell timestamp={f.creation_timestamp || ''} />
          <Td>
            <Badge variant={podStatusVariant(f.phase ?? '')}>{f.phase ?? ''}</Badge>
          </Td>
          <Td>
            <button
              className="text-red/60 hover:text-red-500"
              onClick={() => handleDeletePods([f])}
              title="Delete Pod"
            >
              <X className="inline-block h-4 w-4" />
            </button>
          </Td>
        </Tr>
      )}
    />
  );
}
