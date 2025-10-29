import { useState, useCallback } from 'react';
import { Td } from '@/components/ui/table';
import { PaneK8sResource, PaneK8sResourceContextProps } from '../shared/PaneK8sResource';
import { useNamespaceStore } from '@/store/namespaceStore';
import { useSelectedNamespaces } from '@/hooks/useSelectedNamespaces';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import { listReplicaSets, watchReplicaSets, deleteReplicaSets } from '@/api/k8s/replicaSets';
import { V1ReplicaSet } from '@kubernetes/client-node';
import { useFilteredItems } from '@/hooks/useFilteredItems';
import { ColumnDef, TableHeader } from '../../common/TableHeader';
import { BadgeK8sNamespaces } from '../shared/BadgeK8sNamespaces';
import AgeCell from '@/components/common/AgeCell';
import { Badge } from '@/components/ui/badge';
import { readyVariant } from '@/utils/k8s';
import { useDeleteK8sResources } from '@/hooks/useDeleteK8sResources';
import { toast } from 'sonner';
import { BadgeVariant } from '@/types/variant';

export default function PaneK8sReplicaSets({ context }: PaneK8sResourceContextProps) {
  const selectedNamespaces = useNamespaceStore((s) => s.selectedNamespaces);
  const setSelectedNamespaces = useNamespaceStore((s) => s.setSelectedNamespaces);
  const namespaceList = useSelectedNamespaces(context);

  const { items, loading, error } = useListK8sResources<V1ReplicaSet>(
    listReplicaSets,
    watchReplicaSets,
    context,
    selectedNamespaces
  );

  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState<keyof V1ReplicaSet>('metadata');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedReplicaSets, setSelectedReplicaSets] = useState<V1ReplicaSet[]>([]);

  const filtered = useFilteredItems(
    items,
    selectedNamespaces,
    q,
    ['metadata.name', 'metadata.namespace'],
    sortBy,
    sortOrder
  );

  const { handleDeleteResources } = useDeleteK8sResources<V1ReplicaSet>(deleteReplicaSets, context);

  const toggleReplicaSet = useCallback((rs: V1ReplicaSet) => {
    setSelectedReplicaSets((prev) =>
      prev.includes(rs) ? prev.filter((r) => r !== rs) : [...prev, rs]
    );
  }, []);

  const toggleAllReplicaSets = useCallback(
    (checked: boolean) => {
      setSelectedReplicaSets(checked ? [...filtered] : []);
    },
    [filtered]
  );

  const handleDeleteSelected = useCallback(async () => {
    if (!selectedReplicaSets.length) return toast.error('No ReplicaSets selected');
    await handleDeleteResources(selectedReplicaSets);
    setSelectedReplicaSets([]);
  }, [selectedReplicaSets, handleDeleteResources]);

  const columns: ColumnDef<keyof V1ReplicaSet | ''>[] = [
    { label: 'Name', key: 'metadata' },
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
      onToggleAll={toggleAllReplicaSets}
      selectedItems={selectedReplicaSets}
      totalItems={filtered}
    />
  );

  const renderRow = (rs: V1ReplicaSet) => (
    <>
      <Td className="max-w-truncate align-middle">
        <span className="block truncate" title={rs.metadata?.name}>
          {rs.metadata?.name}
        </span>
      </Td>
      <Td>
        <BadgeK8sNamespaces name={rs.metadata?.namespace ?? ''} />
      </Td>
      <Td>
        <Badge
          variant={
            readyVariant(
              `${rs.status?.readyReplicas ?? 0}/${rs.status?.replicas ?? 0}`
            ) as BadgeVariant
          }
        >
          {rs.status?.readyReplicas ?? 0} / {rs.status?.replicas ?? 0}
        </Badge>
      </Td>
      <AgeCell timestamp={rs.metadata?.creationTimestamp ?? ''} />
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
      selectedItems={selectedReplicaSets}
      onToggleItem={toggleReplicaSet}
      onToggleAll={toggleAllReplicaSets}
      onDeleteSelected={handleDeleteSelected}
      colSpan={columns.length + 1}
      tableHeader={tableHeader}
      renderRow={renderRow}
    />
  );
}
