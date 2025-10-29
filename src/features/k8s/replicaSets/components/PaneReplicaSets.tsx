import { useState, useCallback } from 'react';
import { V1ReplicaSet, V1Namespace } from '@kubernetes/client-node';
import { Td } from '@/components/ui/table';
import { PaneResource } from '../../common/components/PaneGeneric';
import { ColumnDef, TableHeader } from '../../../../components/common/TableHeader';
import { BadgeNamespaces } from '../../common/components/BadgeNamespaces';
import AgeCell from '@/components/common/AgeCell';
import { BadgeStatus } from '../../common/components/BadgeStatus';
import { getReplicaSetStatus } from '../utils/replicaSetStatus';

export interface PaneReplicaSetsProps {
  selectedNamespaces: string[];
  onSelectNamespace: (namespaces: string[]) => void;
  namespaceList: V1Namespace[];
  items: V1ReplicaSet[];
  loading: boolean;
  error: string;
  onDeleteReplicaSets: (replicaSets: V1ReplicaSet[]) => Promise<void>;
}

export default function PaneReplicaSets({
  selectedNamespaces,
  onSelectNamespace,
  namespaceList,
  items,
  loading,
  error,
  onDeleteReplicaSets,
}: PaneReplicaSetsProps) {
  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState<keyof V1ReplicaSet>('metadata');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedItems, setSelectedItems] = useState<V1ReplicaSet[]>([]);

  const toggleItem = useCallback((rs: V1ReplicaSet) => {
    setSelectedItems((prev) => (prev.includes(rs) ? prev.filter((r) => r !== rs) : [...prev, rs]));
  }, []);

  const toggleAll = useCallback(
    (checked: boolean) => {
      setSelectedItems(checked ? [...items] : []);
    },
    [items]
  );

  const handleDeleteSelected = useCallback(async () => {
    if (!selectedItems.length) return;
    await onDeleteReplicaSets(selectedItems);
    setSelectedItems([]);
  }, [selectedItems, onDeleteReplicaSets]);

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
      onToggleAll={toggleAll}
      selectedItems={selectedItems}
      totalItems={items}
    />
  );

  const renderRow = (rs: V1ReplicaSet) => {
    return (
      <>
        <Td className="max-w-truncate align-middle">
          <span className="block truncate" title={rs.metadata?.name}>
            {rs.metadata?.name}
          </span>
        </Td>
        <Td>
          <BadgeNamespaces name={rs.metadata?.namespace ?? ''} />
        </Td>
        <Td>
          <BadgeStatus status={getReplicaSetStatus(rs)} />
        </Td>
        <AgeCell timestamp={rs.metadata?.creationTimestamp ?? ''} />
      </>
    );
  };

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
