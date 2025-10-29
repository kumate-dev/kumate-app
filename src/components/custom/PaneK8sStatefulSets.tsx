import { useState, useCallback } from 'react';
import { Td } from '@/components/ui/table';
import { PaneK8sResource, PaneK8sResourceContextProps } from './PaneK8sResource';
import { useNamespaceStore } from '@/store/namespaceStore';
import { useSelectedNamespaces } from '@/hooks/useSelectedNamespaces';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import { listStatefulSets, watchStatefulSets, deleteStatefulSets } from '@/api/k8s/statefulSets';
import { V1StatefulSet } from '@kubernetes/client-node';
import { useFilteredItems } from '@/hooks/useFilteredItems';
import { ColumnDef, TableHeader } from './TableHeader';
import { BadgeK8sNamespaces } from './BadgeK8sNamespaces';
import AgeCell from '@/components/custom/AgeCell';
import { Badge } from '@/components/ui/badge';
import { readyVariant } from '@/utils/k8s';
import { useDeleteK8sResources } from '@/hooks/useDeleteK8sResources';
import { toast } from 'sonner';
import { BadgeVariant } from '@/types/variant';

export default function PaneK8sStatefulSets({ context }: PaneK8sResourceContextProps) {
  const selectedNamespaces = useNamespaceStore((s) => s.selectedNamespaces);
  const setSelectedNamespaces = useNamespaceStore((s) => s.setSelectedNamespaces);
  const namespaceList = useSelectedNamespaces(context);

  const { items, loading, error } = useListK8sResources<V1StatefulSet>(
    listStatefulSets,
    watchStatefulSets,
    context,
    selectedNamespaces
  );

  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState<keyof V1StatefulSet>('metadata');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedSets, setSelectedSets] = useState<V1StatefulSet[]>([]);

  const filtered = useFilteredItems(
    items,
    selectedNamespaces,
    q,
    ['metadata.name', 'metadata.namespace'],
    sortBy,
    sortOrder
  );

  const { handleDeleteResources } = useDeleteK8sResources<V1StatefulSet>(
    deleteStatefulSets,
    context
  );

  const toggleSet = useCallback((ss: V1StatefulSet) => {
    setSelectedSets((prev) => (prev.includes(ss) ? prev.filter((s) => s !== ss) : [...prev, ss]));
  }, []);

  const toggleAllSets = useCallback(
    (checked: boolean) => {
      setSelectedSets(checked ? [...filtered] : []);
    },
    [filtered]
  );

  const handleDeleteSelected = useCallback(async () => {
    if (!selectedSets.length) return toast.error('No StatefulSets selected');
    await handleDeleteResources(selectedSets);
    setSelectedSets([]);
  }, [selectedSets, handleDeleteResources]);

  const columns: ColumnDef<keyof V1StatefulSet | ''>[] = [
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
      onToggleAll={toggleAllSets}
      selectedItems={selectedSets}
      totalItems={filtered}
    />
  );

  const renderRow = (ss: V1StatefulSet) => (
    <>
      <Td className="max-w-truncate align-middle">
        <span className="block truncate" title={ss.metadata?.name}>
          {ss.metadata?.name}
        </span>
      </Td>
      <Td />
      <Td>
        <BadgeK8sNamespaces name={ss.metadata?.namespace ?? ''} />
      </Td>
      <Td>
        <Badge
          variant={
            readyVariant(
              `${ss.status?.readyReplicas ?? 0}/${ss.status?.replicas ?? 0}`
            ) as BadgeVariant
          }
        >
          {ss.status?.readyReplicas ?? 0} / {ss.status?.replicas ?? 0}
        </Badge>
      </Td>
      <AgeCell timestamp={ss.metadata?.creationTimestamp ?? ''} />
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
      selectedItems={selectedSets}
      onToggleItem={toggleSet}
      onToggleAll={toggleAllSets}
      onDeleteSelected={handleDeleteSelected}
      colSpan={columns.length + 1}
      tableHeader={tableHeader}
      renderRow={renderRow}
    />
  );
}
