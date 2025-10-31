import { useState, useCallback } from 'react';
import { V1StatefulSet, V1Namespace } from '@kubernetes/client-node';
import { Td } from '@/components/ui/table';
import { PaneGeneric } from '../../generic/components/PaneGeneric';
import { ColumnDef, TableHeader } from '../../../../components/common/TableHeader';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import AgeCell from '@/components/common/AgeCell';
import { BadgeStatus } from '../../generic/components/BadgeStatus';
import { getStatefulSetStatus } from '../utils/statefulSetStatus';

export interface PaneStatefulSetsProps {
  selectedNamespaces: string[];
  onSelectNamespace: (namespaces: string[]) => void;
  namespaceList: V1Namespace[];
  items: V1StatefulSet[];
  loading: boolean;
  error: string;
  onDeleteStatefulSets: (statefulSets: V1StatefulSet[]) => Promise<void>;
}

export default function PaneStatefulSets({
  selectedNamespaces,
  onSelectNamespace,
  namespaceList,
  items,
  loading,
  error,
  onDeleteStatefulSets,
}: PaneStatefulSetsProps) {
  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState<keyof V1StatefulSet>('metadata');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedItems, setSelectedItems] = useState<V1StatefulSet[]>([]);

  const toggleItem = useCallback((ss: V1StatefulSet) => {
    setSelectedItems((prev) => (prev.includes(ss) ? prev.filter((s) => s !== ss) : [...prev, ss]));
  }, []);

  const toggleAll = useCallback(
    (checked: boolean) => {
      setSelectedItems(checked ? [...items] : []);
    },
    [items]
  );

  const handleDeleteSelected = useCallback(async () => {
    if (!selectedItems.length) return;
    await onDeleteStatefulSets(selectedItems);
    setSelectedItems([]);
  }, [selectedItems, onDeleteStatefulSets]);

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
      onToggleAll={toggleAll}
      selectedItems={selectedItems}
      totalItems={items}
    />
  );

  const renderRow = (ss: V1StatefulSet) => {
    return (
      <>
        <Td className="max-w-truncate align-middle">
          <span className="block truncate" title={ss.metadata?.name}>
            {ss.metadata?.name}
          </span>
        </Td>
        <Td />
        <Td>
          <BadgeNamespaces name={ss.metadata?.namespace ?? ''} />
        </Td>
        <Td>
          <BadgeStatus status={getStatefulSetStatus(ss)} />
        </Td>
        <AgeCell timestamp={ss.metadata?.creationTimestamp ?? ''} />
      </>
    );
  };

  return (
    <PaneGeneric
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
      onDelete={handleDeleteSelected}
      colSpan={columns.length + 1}
      tableHeader={tableHeader}
      renderRow={renderRow}
    />
  );
}
