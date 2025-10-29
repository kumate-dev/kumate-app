import { useState, useCallback, RefObject } from 'react';
import { V1Pod } from '@kubernetes/client-node';
import { useNamespaceStore } from '@/store/namespaceStore';
import { useSelectedNamespaces } from '@/hooks/useSelectedNamespaces';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import { listPods, watchPods, deletePods } from '@/api/k8s/pods';
import { Td } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { AlertTriangle } from 'lucide-react';
import { useFilteredItems } from '@/hooks/useFilteredItems';
import { useDeleteK8sResources } from '@/hooks/useDeleteK8sResources';
import { toast } from 'sonner';
import { SidebarK8sPods } from './SidebarK8sPods';
import { PaneResource, PaneResourceContextProps } from '../../common/components/PaneGeneric';
import { ColumnDef, TableHeader } from '@/components/common/TableHeader';
import { BadgeNamespaces } from '../../common/components/BadgeNamespaces';
import { podHasPodWarning } from '../utils/podHasWarning';
import { podDots } from '../utils/podDots';
import { podRestartCount } from '../utils/podRestartCount';
import { BadgePodStatus } from './BadgePodStatus';

export default function PanePods({ context }: PaneResourceContextProps) {
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
  const [selectedPod, setSelectedPod] = useState<V1Pod | null>(null);

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
    setSelectedPod(null);
  }, [selectedPods, handleDeleteResources]);

  const handleDeleteOne = async (item: V1Pod) => {
    await handleDeleteResources([item]);
    setSelectedPod(null);
  };

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

  const renderRow = (pod: V1Pod) => (
    <>
      <Td className="max-w-truncate align-middle">
        <span className="block truncate" title={pod.metadata?.name ?? ''}>
          {pod.metadata?.name}
        </span>
      </Td>
      <Td className="text-center align-middle">
        {podHasPodWarning(pod) && (
          <AlertTriangle className="inline-block h-4 w-4 text-yellow-400" />
        )}
      </Td>
      <Td>
        <BadgeNamespaces name={pod.metadata?.namespace ?? ''} />
      </Td>
      <Td className="align-middle">
        <div className="inline-flex items-center gap-1">
          {pod.status?.containerStatuses?.length
            ? pod.status.containerStatuses.map((st, idx) => (
                <span
                  key={idx}
                  className={`h-2.5 w-2.5 rounded-full ${podDots(
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
      <Td>{podRestartCount(pod)}</Td>
      <Td>{pod.metadata?.ownerReferences?.map((o) => o.name).join(', ') || '-'}</Td>
      <Td>{pod.spec?.nodeName || '-'}</Td>
      <Td>{pod.status?.qosClass || '-'}</Td>
      <AgeCell timestamp={pod.metadata?.creationTimestamp} />
      <Td>
        <BadgePodStatus status={pod.status?.phase} />
      </Td>
    </>
  );

  const renderSidebar = (item: V1Pod, tableRef: RefObject<HTMLTableElement | null>) => (
    <SidebarK8sPods
      item={item}
      setItem={setSelectedPod}
      onDelete={handleDeleteOne}
      tableRef={tableRef}
    />
  );

  return (
    <PaneResource
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
      onToggleAll={toggleAllPods}
      onDeleteSelected={handleDeleteSelected}
      colSpan={columns.length + 1}
      tableHeader={tableHeader}
      renderRow={renderRow}
      onRowClick={setSelectedPod}
      selectedItem={selectedPod}
      renderSidebar={renderSidebar}
    />
  );
}
