import { useState, useCallback } from 'react';
import { V1Job } from '@kubernetes/client-node';
import { PaneK8sResource, PaneK8sResourceContextProps } from './PaneK8sResource';
import { useNamespaceStore } from '@/store/namespaceStore';
import { useSelectedNamespaces } from '@/hooks/useSelectedNamespaces';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import { listJobs, watchJobs, deleteJobs } from '@/api/k8s/jobs';
import { ColumnDef, TableHeader } from './TableHeader';
import { Td } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import AgeCell from '@/components/custom/AgeCell';
import { useFilteredItems } from '@/hooks/useFilteredItems';
import { BadgeK8sNamespaces } from './BadgeK8sNamespaces';
import { useDeleteK8sResources } from '@/hooks/useDeleteK8sResources';
import { toast } from 'sonner';

export default function PaneK8sJobs({ context }: PaneK8sResourceContextProps) {
  const selectedNamespaces = useNamespaceStore((s) => s.selectedNamespaces);
  const setSelectedNamespaces = useNamespaceStore((s) => s.setSelectedNamespaces);
  const namespaceList = useSelectedNamespaces(context);

  const { items, loading, error } = useListK8sResources<V1Job>(
    listJobs,
    watchJobs,
    context,
    selectedNamespaces
  );

  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState<keyof V1Job>('metadata');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedItems, setSelectedItems] = useState<V1Job[]>([]);

  const filtered = useFilteredItems(
    items,
    selectedNamespaces,
    q,
    ['metadata.name', 'metadata.namespace'],
    'metadata.name',
    'asc'
  );

  const { handleDeleteResources } = useDeleteK8sResources<V1Job>(deleteJobs, context);

  const toggleItem = useCallback((job: V1Job) => {
    setSelectedItems((prev) =>
      prev.includes(job) ? prev.filter((j) => j !== job) : [...prev, job]
    );
  }, []);

  const toggleAll = useCallback(
    (checked: boolean) => setSelectedItems(checked ? [...filtered] : []),
    [filtered]
  );

  const handleDeleteSelected = useCallback(async () => {
    if (!selectedItems.length) return toast.error('No jobs selected');
    await handleDeleteResources(selectedItems);
    setSelectedItems([]);
  }, [selectedItems, handleDeleteResources]);

  const progressVariant = (job: V1Job) => {
    const succeeded = job.status?.succeeded ?? 0;
    const completions = job.spec?.completions ?? 0;
    if (completions > 0) return succeeded >= completions ? 'success' : 'warning';
    return 'default';
  };

  const columns: ColumnDef<keyof V1Job | ''>[] = [
    { label: 'Name', key: 'metadata' },
    { label: 'Namespace', key: 'metadata' },
    { label: 'Progress', key: 'status' },
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
      renderRow={(job) => (
        <>
          <Td className="max-w-truncate align-middle">
            <span className="block truncate" title={job.metadata?.name ?? ''}>
              {job.metadata?.name}
            </span>
          </Td>
          <Td>
            <BadgeK8sNamespaces name={job.metadata?.namespace ?? ''} />
          </Td>
          <Td>
            <Badge variant={progressVariant(job)}>
              {`${job.status?.succeeded ?? 0}/${job.spec?.completions ?? '-'}`}
            </Badge>
          </Td>
          <AgeCell timestamp={job.metadata?.creationTimestamp ?? ''} />
          <Td>
            <button className="text-white/60 hover:text-white/80">⋮</button>
          </Td>
        </>
      )}
    />
  );
}
