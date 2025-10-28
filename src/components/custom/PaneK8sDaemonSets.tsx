import { useState, useCallback } from 'react';
import { PaneK8sResource, PaneK8sResourceContextProps } from './PaneK8sResource';
import { useNamespaceStore } from '@/state/namespaceStore';
import { useSelectedNamespaces } from '@/hooks/useSelectedNamespaces';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import { listDaemonSets, watchDaemonSets, deleteDaemonSets } from '@/services/daemonSets';
import { V1DaemonSet } from '@kubernetes/client-node';
import { useFilteredItems } from '@/hooks/useFilteredItems';
import { ColumnDef, TableHeader } from './TableHeader';
import { Td } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import AgeCell from '@/components/custom/AgeCell';
import { readyVariant } from '@/utils/k8s';
import { BadgeVariant } from '@/types/variant';
import { BadgeK8sNamespaces } from './BadgeK8sNamespaces';
import { useDeleteK8sResources } from '@/hooks/useDeleteK8sResources';
import { toast } from 'sonner';
import { AlertTriangle } from 'lucide-react';

type SortKey = keyof V1DaemonSet;

export default function PaneK8sDaemonSets({ context }: PaneK8sResourceContextProps) {
  const selectedNamespaces = useNamespaceStore((s) => s.selectedNamespaces);
  const setSelectedNamespaces = useNamespaceStore((s) => s.setSelectedNamespaces);
  const namespaceList = useSelectedNamespaces(context);

  const { items, loading, error } = useListK8sResources<V1DaemonSet>(
    listDaemonSets,
    watchDaemonSets,
    context,
    selectedNamespaces
  );

  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('metadata');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedDaemonSets, setSelectedDaemonSets] = useState<V1DaemonSet[]>([]);

  const filtered = useFilteredItems(
    items,
    selectedNamespaces,
    q,
    ['metadata.name', 'metadata.namespace'],
    sortBy,
    sortOrder
  );

  const { handleDeleteResources } = useDeleteK8sResources<V1DaemonSet>(deleteDaemonSets, context);

  const toggleDaemonSet = useCallback((ds: V1DaemonSet) => {
    setSelectedDaemonSets((prev) =>
      prev.includes(ds) ? prev.filter((d) => d !== ds) : [...prev, ds]
    );
  }, []);

  const toggleAllDaemonSets = useCallback(
    (checked: boolean) => {
      setSelectedDaemonSets(checked ? [...filtered] : []);
    },
    [filtered]
  );

  const handleDeleteSelected = useCallback(async () => {
    if (selectedDaemonSets.length === 0) return toast.error('No DaemonSets selected');
    await handleDeleteResources(selectedDaemonSets);
    setSelectedDaemonSets([]);
  }, [selectedDaemonSets, handleDeleteResources]);

  const columns: ColumnDef<SortKey | ''>[] = [
    { label: 'Name', key: 'metadata' },
    { label: '', key: '', sortable: false },
    { label: 'Namespace', key: 'metadata' },
    { label: 'Ready', key: 'status' },
    { label: 'Age', key: 'metadata' },
  ];

  const tableHeader = (
    <TableHeader
      columns={columns}
      sortBy={sortBy}
      sortOrder={sortOrder}
      setSortBy={setSortBy}
      setSortOrder={setSortOrder}
      onToggleAll={toggleAllDaemonSets}
      selectedItems={selectedDaemonSets}
      totalItems={filtered}
    />
  );

  const hasWarning = (ds: V1DaemonSet) =>
    (ds.status?.numberReady ?? 0) < (ds.status?.desiredNumberScheduled ?? 0);

  const renderRow = (ds: V1DaemonSet) => (
    <>
      <Td className="max-w-truncate align-middle">
        <span className="block truncate" title={ds.metadata?.name}>
          {ds.metadata?.name}
        </span>
      </Td>
      <Td className="text-center align-middle">
        {hasWarning(ds) && <AlertTriangle className="inline-block h-4 w-4 text-yellow-400" />}
      </Td>
      <Td>
        <BadgeK8sNamespaces name={ds.metadata?.namespace ?? ''} />
      </Td>
      <Td>
        <Badge
          variant={
            readyVariant(
              `${ds.status?.numberReady ?? 0}/${ds.status?.desiredNumberScheduled ?? 0}`
            ) as BadgeVariant
          }
        >
          {ds.status?.numberReady ?? 0} / {ds.status?.desiredNumberScheduled ?? 0}
        </Badge>
      </Td>
      <AgeCell timestamp={ds.metadata?.creationTimestamp ?? ''} />
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
      selectedItems={selectedDaemonSets}
      onToggleItem={toggleDaemonSet}
      onToggleAll={toggleAllDaemonSets}
      onDeleteSelected={handleDeleteSelected}
      colSpan={columns.length + 1}
      tableHeader={tableHeader}
      renderRow={renderRow}
    />
  );
}
