import { useState, useCallback } from 'react';
import { V1Job, V1Namespace } from '@kubernetes/client-node';
import { PaneResource } from '../../generic/components/PaneGeneric';
import { ColumnDef, TableHeader } from '../../../../components/common/TableHeader';
import { Td } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import { BadgeStatus } from '../../generic/components/BadgeStatus';
import { getJobStatus } from '../utils/jobStatus';

export interface PaneJobsProps {
  selectedNamespaces: string[];
  onSelectNamespace: (namespaces: string[]) => void;
  namespaceList: V1Namespace[];
  items: V1Job[];
  loading: boolean;
  error: string;
  onDeleteJobs: (jobs: V1Job[]) => Promise<void>;
}

export default function PaneJobs({
  selectedNamespaces,
  onSelectNamespace,
  namespaceList,
  items,
  loading,
  error,
  onDeleteJobs,
}: PaneJobsProps) {
  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState<keyof V1Job>('metadata');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedItems, setSelectedItems] = useState<V1Job[]>([]);

  const toggleItem = useCallback((job: V1Job) => {
    setSelectedItems((prev) =>
      prev.includes(job) ? prev.filter((j) => j !== job) : [...prev, job]
    );
  }, []);

  const toggleAll = useCallback(
    (checked: boolean) => setSelectedItems(checked ? [...items] : []),
    [items]
  );

  const handleDeleteSelected = useCallback(async () => {
    if (!selectedItems.length) return;
    await onDeleteJobs(selectedItems);
    setSelectedItems([]);
  }, [selectedItems, onDeleteJobs]);

  const columns: ColumnDef<keyof V1Job | ''>[] = [
    { label: 'Name', key: 'metadata' },
    { label: 'Namespace', key: 'metadata' },
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
      onToggleAll={toggleAll}
      selectedItems={selectedItems}
      totalItems={items}
    />
  );

  const renderRow = (job: V1Job) => (
    <>
      <Td className="max-w-truncate align-middle">
        <span className="block truncate" title={job.metadata?.name ?? ''}>
          {job.metadata?.name}
        </span>
      </Td>
      <Td>
        <BadgeNamespaces name={job.metadata?.namespace ?? ''} />
      </Td>
      <AgeCell timestamp={job.metadata?.creationTimestamp ?? ''} />
      <Td>
        <BadgeStatus status={getJobStatus(job)} />
      </Td>
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
