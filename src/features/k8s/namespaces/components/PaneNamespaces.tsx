import { useState } from 'react';
import { V1Namespace } from '@kubernetes/client-node';
import { Td, Tr } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { ColumnDef, TableHeader } from '../../../../components/common/TableHeader';
import { PaneResource } from '../../common/components/PaneGeneric';
import { BadgeStatus } from '../../common/components/BadgeStatus';
import { getNamespaceStatus } from '../utils/namespaceStatus';

export interface PaneNamespacesProps {
  items: V1Namespace[];
  loading: boolean;
  error: string;
  onDeleteNamespaces?: (namespaces: V1Namespace[]) => Promise<void>;
}

export default function PaneNamespaces({
  items,
  loading,
  error,
  onDeleteNamespaces,
}: PaneNamespacesProps) {
  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState<keyof V1Namespace>('metadata');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedItems, setSelectedItems] = useState<V1Namespace[]>([]);

  const toggleItem = (ns: V1Namespace) => {
    setSelectedItems((prev) => (prev.includes(ns) ? prev.filter((n) => n !== ns) : [...prev, ns]));
  };

  const toggleAll = (checked: boolean) => {
    setSelectedItems(checked ? [...items] : []);
  };

  const handleDeleteSelected = async () => {
    if (!selectedItems.length || !onDeleteNamespaces) return;
    await onDeleteNamespaces(selectedItems);
    setSelectedItems([]);
  };

  const columns: ColumnDef<keyof V1Namespace | ''>[] = [
    { label: 'Name', key: 'metadata' },
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

  const renderRow = (ns: V1Namespace) => (
    <Tr key={ns.metadata?.name}>
      <Td className="max-w-truncate" title={ns.metadata?.name}>
        {ns.metadata?.name}
      </Td>
      <AgeCell timestamp={ns.metadata?.creationTimestamp || ''} />
      <Td>
        <BadgeStatus status={getNamespaceStatus(ns)} />
      </Td>
    </Tr>
  );

  return (
    <PaneResource
      items={items}
      loading={loading}
      error={error}
      query={q}
      onQueryChange={setQ}
      showNamespace={false}
      selectedItems={selectedItems}
      onToggleItem={toggleItem}
      onDeleteSelected={onDeleteNamespaces ? handleDeleteSelected : undefined}
      colSpan={columns.length}
      tableHeader={tableHeader}
      renderRow={renderRow}
    />
  );
}
