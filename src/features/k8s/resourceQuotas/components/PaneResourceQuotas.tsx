import { useState, useCallback } from 'react';
import { V1ResourceQuota, V1Namespace } from '@kubernetes/client-node';
import { Td } from '@/components/ui/table';
import { PaneGeneric } from '../../generic/components/PaneGeneric';
import { ColumnDef, TableHeader } from '../../../../components/common/TableHeader';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import AgeCell from '@/components/common/AgeCell';
import { renderKeyValue } from '../utils/renderKeyValue';

export interface PaneResourceQuotasProps {
  selectedNamespaces: string[];
  onSelectNamespace: (namespaces: string[]) => void;
  namespaceList: V1Namespace[];
  items: V1ResourceQuota[];
  loading: boolean;
  error: string;
  onDeleteResourceQuotas: (resourceQuotas: V1ResourceQuota[]) => Promise<void>;
}

export default function PaneResourceQuotas({
  selectedNamespaces,
  onSelectNamespace,
  namespaceList,
  items,
  loading,
  error,
  onDeleteResourceQuotas,
}: PaneResourceQuotasProps) {
  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState<keyof V1ResourceQuota>('metadata');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedItems, setSelectedItems] = useState<V1ResourceQuota[]>([]);

  const toggleItem = useCallback((rq: V1ResourceQuota) => {
    setSelectedItems((prev) => (prev.includes(rq) ? prev.filter((r) => r !== rq) : [...prev, rq]));
  }, []);

  const toggleAll = useCallback(
    (checked: boolean) => setSelectedItems(checked ? [...items] : []),
    [items]
  );

  const handleDeleteSelected = useCallback(async () => {
    if (!selectedItems.length) return;
    await onDeleteResourceQuotas(selectedItems);
    setSelectedItems([]);
  }, [selectedItems, onDeleteResourceQuotas]);

  const columns: ColumnDef<keyof V1ResourceQuota | ''>[] = [
    { label: 'Name', key: 'metadata' },
    { label: 'Namespace', key: 'metadata' },
    { label: 'Hard', key: 'status' },
    { label: 'Used', key: 'status' },
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

  const renderRow = (rq: V1ResourceQuota) => {
    const hardResources = renderKeyValue(rq.status?.hard as Record<string, string>);
    const usedResources = renderKeyValue(rq.status?.used as Record<string, string>);

    return (
      <>
        <Td className="max-w-truncate align-middle">
          <span className="block truncate" title={rq.metadata?.name}>
            {rq.metadata?.name}
          </span>
        </Td>
        <Td>
          <BadgeNamespaces name={rq.metadata?.namespace ?? ''} />
        </Td>
        <Td className="max-w-truncate" title={hardResources.title}>
          {hardResources.display}
        </Td>
        <Td className="max-w-truncate" title={usedResources.title}>
          {usedResources.display}
        </Td>
        <AgeCell timestamp={rq.metadata?.creationTimestamp ?? ''} />
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
