import { useState, useCallback } from 'react';
import { V1CronJob, V1Namespace } from '@kubernetes/client-node';
import { PaneResource } from '../../generic/components/PaneGeneric';
import { ColumnDef, TableHeader } from '../../../../components/common/TableHeader';
import { Td } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import { BadgeStatus } from '../../generic/components/BadgeStatus';
import { getCronJobStatus } from '../utils/cronJobStatus';

export interface PaneCronJobsProps {
  selectedNamespaces: string[];
  onSelectNamespace: (namespaces: string[]) => void;
  namespaceList: V1Namespace[];
  items: V1CronJob[];
  loading: boolean;
  error: string;
  onDeleteCronJobs: (cronJobs: V1CronJob[]) => Promise<void>;
}

export default function PaneCronJobs({
  selectedNamespaces,
  onSelectNamespace,
  namespaceList,
  items,
  loading,
  error,
  onDeleteCronJobs,
}: PaneCronJobsProps) {
  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState<keyof V1CronJob>('metadata');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedItems, setSelectedItems] = useState<V1CronJob[]>([]);

  const toggleItem = useCallback((item: V1CronJob) => {
    setSelectedItems((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  }, []);

  const toggleAll = useCallback(
    (checked: boolean) => {
      setSelectedItems(checked ? [...items] : []);
    },
    [items]
  );

  const handleDeleteSelected = useCallback(async () => {
    if (selectedItems.length === 0) return;
    await onDeleteCronJobs(selectedItems);
    setSelectedItems([]);
  }, [selectedItems, onDeleteCronJobs]);

  const columns: ColumnDef<keyof V1CronJob | ''>[] = [
    { label: 'Name', key: 'metadata' },
    { label: 'Namespace', key: 'metadata' },
    { label: 'Schedule', key: 'spec' },
    { label: 'Status', key: 'status' },
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
      totalItems={items}
    />
  );

  const renderRow = (cj: V1CronJob) => (
    <>
      <Td className="max-w-truncate align-middle">
        <span className="block truncate" title={cj.metadata?.name ?? ''}>
          {cj.metadata?.name}
        </span>
      </Td>
      <Td>
        <BadgeNamespaces name={cj.metadata?.namespace ?? ''} />
      </Td>
      <Td>{cj.spec?.schedule ?? '-'}</Td>
      <Td>
        <BadgeStatus status={getCronJobStatus(cj)} />
      </Td>
      <AgeCell timestamp={cj.status?.lastScheduleTime ?? ''} />
      <AgeCell timestamp={cj.metadata?.creationTimestamp ?? ''} />
    </>
  );

  return (
    <PaneResource
      items={items}
      loading={loading}
      error={error}
      query={q}
      onQueryChange={setQ}
      namespaceList={namespaceList}
      selectedNamespaces={selectedNamespaces}
      onSelectNamespace={onSelectNamespace}
      selectedItems={selectedItems}
      onToggleItem={toggleItem}
      onDeleteSelected={handleDeleteSelected}
      colSpan={columns.length + 1}
      tableHeader={tableHeader}
      renderRow={renderRow}
    />
  );
}
