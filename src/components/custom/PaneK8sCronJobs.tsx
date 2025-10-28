import { useState, useCallback } from 'react';
import { V1CronJob } from '@kubernetes/client-node';
import { PaneK8sResource, PaneK8sResourceContextProps } from './PaneK8sResource';
import { useNamespaceStore } from '@/state/namespaceStore';
import { useSelectedNamespaces } from '@/hooks/useSelectedNamespaces';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import { listCronJobs, watchCronJobs, deleteCronJobs } from '@/services/cronJobs';
import { ColumnDef, TableHeader } from './TableHeader';
import { Td } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import AgeCell from '@/components/custom/AgeCell';
import { useFilteredItems } from '@/hooks/useFilteredItems';
import { BadgeK8sNamespaces } from './BadgeK8sNamespaces';
import { useDeleteK8sResources } from '@/hooks/useDeleteK8sResources';
import { toast } from 'sonner';
import { EventType } from '@/types/k8sEvent';

export default function PaneK8sCronJobs({ context }: PaneK8sResourceContextProps) {
  const selectedNamespaces = useNamespaceStore((s) => s.selectedNamespaces);
  const setSelectedNamespaces = useNamespaceStore((s) => s.setSelectedNamespaces);
  const namespaceList = useSelectedNamespaces(context);

  const { items, loading, error } = useListK8sResources<V1CronJob>(
    listCronJobs,
    watchCronJobs,
    context,
    selectedNamespaces
  );

  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState<keyof V1CronJob>('metadata');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedItems, setSelectedItems] = useState<V1CronJob[]>([]);

  const filtered = useFilteredItems(
    items,
    selectedNamespaces,
    q,
    ['metadata.name', 'metadata.namespace', 'spec.schedule', 'spec.suspend'],
    'metadata.name',
    'asc'
  );

  const { handleDeleteResources } = useDeleteK8sResources<V1CronJob>(deleteCronJobs, context);

  const toggleItem = useCallback((item: V1CronJob) => {
    setSelectedItems((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  }, []);

  const toggleAll = useCallback(
    (checked: boolean) => {
      setSelectedItems(checked ? [...filtered] : []);
    },
    [filtered]
  );

  const handleDeleteSelected = useCallback(async () => {
    if (selectedItems.length === 0) return toast.error('No CronJobs selected');
    await handleDeleteResources(selectedItems);
    setSelectedItems([]);
  }, [selectedItems, handleDeleteResources]);

  const suspendVariant = (suspend?: boolean) => {
    if (suspend === true) return 'warning';
    if (suspend === false) return 'success';
    return 'default';
  };

  const columns: ColumnDef<keyof V1CronJob | ''>[] = [
    { label: 'Name', key: 'metadata' },
    { label: '', key: '', sortable: false },
    { label: 'Namespace', key: 'metadata' },
    { label: 'Schedule', key: 'spec' },
    { label: 'Suspend', key: 'spec' },
    { label: 'Last Schedule', key: 'status' },
    { label: 'Age', key: 'metadata' },
  ];

  const tableHeader = (
    <TableHeader
      columns={columns}
      sortBy={sortBy}
      sortOrder={sortOrder}
      setSortBy={setSortBy}
      setSortOrder={setSortOrder}
      onToggleAll={toggleAll}
      selectedItems={selectedItems}
      totalItems={filtered}
    />
  );

  const renderRow = (cj: V1CronJob) => (
    <>
      <Td className="max-w-truncate align-middle">
        <span className="block truncate" title={cj.metadata?.name ?? ''}>
          {cj.metadata?.name}
        </span>
      </Td>
      <Td className="text-center align-middle">
        {cj.spec?.suspend && <span className="inline-block h-3 w-3 rounded-full bg-yellow-500" />}
      </Td>
      <Td>
        <BadgeK8sNamespaces name={cj.metadata?.namespace ?? ''} />
      </Td>
      <Td>{cj.spec?.schedule ?? '-'}</Td>
      <Td>
        <Badge variant={suspendVariant(cj.spec?.suspend)}>{String(cj.spec?.suspend)}</Badge>
      </Td>
      <AgeCell timestamp={cj.status?.lastScheduleTime ?? ''} />
      <AgeCell timestamp={cj.metadata?.creationTimestamp ?? ''} />
      <Td>
        <button className="text-white/60 hover:text-white/80">⋮</button>
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
      selectedItems={selectedItems}
      onToggleItem={toggleItem}
      onDeleteSelected={handleDeleteSelected}
      colSpan={columns.length + 1}
      tableHeader={tableHeader}
      renderRow={renderRow}
    />
  );
}
