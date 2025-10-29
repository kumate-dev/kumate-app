import { useState, useCallback } from 'react';
import { Td } from '@/components/ui/table';
import { PaneResource, PaneResourceContextProps } from '../../common/components/PaneGeneric';
import { useNamespaceStore } from '@/store/namespaceStore';
import { useSelectedNamespaces } from '@/hooks/useSelectedNamespaces';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import {
  listReplicationControllers,
  watchReplicationControllers,
  deleteReplicationControllers,
} from '@/api/k8s/replicationControllers';
import { V1ReplicationController } from '@kubernetes/client-node';
import { useFilteredItems } from '@/hooks/useFilteredItems';
import { ColumnDef, TableHeader } from '../../../../components/common/TableHeader';
import { BadgeNamespaces } from '../../common/components/BadgeNamespaces';
import AgeCell from '@/components/common/AgeCell';
import { Badge } from '@/components/ui/badge';
import { readyVariant } from '@/utils/k8s';
import { useDeleteK8sResources } from '@/hooks/useDeleteK8sResources';
import { toast } from 'sonner';
import { BadgeVariant } from '@/types/variant';

export default function PaneReplicationControllers({ context }: PaneResourceContextProps) {
  const selectedNamespaces = useNamespaceStore((s) => s.selectedNamespaces);
  const setSelectedNamespaces = useNamespaceStore((s) => s.setSelectedNamespaces);
  const namespaceList = useSelectedNamespaces(context);

  const { items, loading, error } = useListK8sResources<V1ReplicationController>(
    listReplicationControllers,
    watchReplicationControllers,
    context,
    selectedNamespaces
  );

  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState<keyof V1ReplicationController>('metadata');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedRCs, setSelectedRCs] = useState<V1ReplicationController[]>([]);

  const filtered = useFilteredItems(
    items,
    selectedNamespaces,
    q,
    ['metadata.name', 'metadata.namespace'],
    sortBy,
    sortOrder
  );

  const { handleDeleteResources } = useDeleteK8sResources<V1ReplicationController>(
    deleteReplicationControllers,
    context
  );

  const toggleRC = useCallback((rc: V1ReplicationController) => {
    setSelectedRCs((prev) => (prev.includes(rc) ? prev.filter((r) => r !== rc) : [...prev, rc]));
  }, []);

  const toggleAllRCs = useCallback(
    (checked: boolean) => {
      setSelectedRCs(checked ? [...filtered] : []);
    },
    [filtered]
  );

  const handleDeleteSelected = useCallback(async () => {
    if (!selectedRCs.length) return toast.error('No ReplicationControllers selected');
    await handleDeleteResources(selectedRCs);
    setSelectedRCs([]);
  }, [selectedRCs, handleDeleteResources]);

  const columns: ColumnDef<keyof V1ReplicationController | ''>[] = [
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
      onToggleAll={toggleAllRCs}
      selectedItems={selectedRCs}
      totalItems={filtered}
    />
  );

  const renderRow = (rc: V1ReplicationController) => (
    <>
      <Td className="max-w-truncate align-middle">
        <span className="block truncate" title={rc.metadata?.name}>
          {rc.metadata?.name}
        </span>
      </Td>
      <Td />
      <Td>
        <BadgeNamespaces name={rc.metadata?.namespace ?? ''} />
      </Td>
      <Td>
        <Badge
          variant={
            readyVariant(
              `${rc.status?.readyReplicas ?? 0}/${rc.status?.replicas ?? 0}`
            ) as BadgeVariant
          }
        >
          {rc.status?.readyReplicas ?? 0} / {rc.status?.replicas ?? 0}
        </Badge>
      </Td>
      <AgeCell timestamp={rc.metadata?.creationTimestamp ?? ''} />
      <Td>
        <button className="text-white/60 hover:text-white/80">⋮</button>
      </Td>
    </>
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
      selectedItems={selectedRCs}
      onToggleItem={toggleRC}
      onToggleAll={toggleAllRCs}
      onDeleteSelected={handleDeleteSelected}
      colSpan={columns.length + 1}
      tableHeader={tableHeader}
      renderRow={renderRow}
    />
  );
}
