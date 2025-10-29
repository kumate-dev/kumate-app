import { useState, useCallback } from 'react';
import { V1ConfigMap, V1Namespace } from '@kubernetes/client-node';
import { Td } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { PaneResource } from '../../common/components/PaneGeneric';
import { ColumnDef, TableHeader } from '@/components/common/TableHeader';
import { BadgeNamespaces } from '../../common/components/BadgeNamespaces';

export interface PaneConfigMapsProps {
  selectedNamespaces: string[];
  onSelectNamespace: (namespaces: string[]) => void;
  namespaceList: V1Namespace[];
  items: V1ConfigMap[];
  loading: boolean;
  error: string;
  onDeleteConfigMaps: (configMaps: V1ConfigMap[]) => Promise<void>;
}

export default function PaneConfigMaps({
  selectedNamespaces,
  onSelectNamespace,
  namespaceList,
  items,
  loading,
  error,
  onDeleteConfigMaps,
}: PaneConfigMapsProps) {
  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState<keyof V1ConfigMap>('metadata');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedItems, setSelectedItems] = useState<V1ConfigMap[]>([]);

  const toggleItem = useCallback((item: V1ConfigMap) => {
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
    await onDeleteConfigMaps(selectedItems);
    setSelectedItems([]);
  }, [selectedItems, onDeleteConfigMaps]);

  const columns: ColumnDef<keyof V1ConfigMap | ''>[] = [
    { label: 'Name', key: 'metadata' },
    { label: 'Namespace', key: 'metadata' },
    { label: 'Keys', key: 'data' },
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

  const renderRow = (cm: V1ConfigMap) => (
    <>
      <Td className="max-w-truncate align-middle">
        <span className="block truncate" title={cm.metadata?.name ?? ''}>
          {cm.metadata?.name}
        </span>
      </Td>
      <Td>
        <BadgeNamespaces name={cm.metadata?.namespace ?? ''} />
      </Td>
      <Td className="max-w-truncate align-middle" title={Object.keys(cm.data || {}).join(', ')}>
        {cm.data && Object.keys(cm.data).length > 0 ? (
          Object.keys(cm.data).join(', ')
        ) : (
          <span className="inline-block h-3 w-3 rounded-full bg-red-500" />
        )}
      </Td>
      <AgeCell timestamp={cm.metadata?.creationTimestamp} />
      <Td>
        <button className="text-white/60 hover:text-white/80">⋮</button>
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
