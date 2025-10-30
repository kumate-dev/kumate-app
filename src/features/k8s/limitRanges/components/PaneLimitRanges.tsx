import { useState, useCallback } from 'react';
import { V1LimitRange, V1Namespace } from '@kubernetes/client-node';
import { PaneResource } from '../../generic/components/PaneGeneric';
import { ColumnDef, TableHeader } from '../../../../components/common/TableHeader';
import { Td } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';

export interface PaneLimitRangesProps {
  selectedNamespaces: string[];
  onSelectNamespace: (namespaces: string[]) => void;
  namespaceList: V1Namespace[];
  items: V1LimitRange[];
  loading: boolean;
  error: string;
  onDeleteLimitRanges: (limitRanges: V1LimitRange[]) => Promise<void>;
}

export default function PaneLimitRanges({
  selectedNamespaces,
  onSelectNamespace,
  namespaceList,
  items,
  loading,
  error,
  onDeleteLimitRanges,
}: PaneLimitRangesProps) {
  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState<keyof V1LimitRange>('metadata');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedItems, setSelectedItems] = useState<V1LimitRange[]>([]);

  const toggleItem = useCallback((lr: V1LimitRange) => {
    setSelectedItems((prev) => (prev.includes(lr) ? prev.filter((i) => i !== lr) : [...prev, lr]));
  }, []);

  const toggleAll = useCallback(
    (checked: boolean) => setSelectedItems(checked ? [...items] : []),
    [items]
  );

  const handleDeleteSelected = useCallback(async () => {
    if (!selectedItems.length) return;
    await onDeleteLimitRanges(selectedItems);
    setSelectedItems([]);
  }, [selectedItems, onDeleteLimitRanges]);

  const renderLimitMap = (map?: Record<string, string>): { display: string; title: string } => {
    if (!map || Object.keys(map).length === 0) return { display: '-', title: '-' };
    const text = Object.entries(map)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    return { display: text, title: text };
  };

  const columns: ColumnDef<keyof V1LimitRange | ''>[] = [
    { label: 'Name', key: 'metadata' },
    { label: 'Namespace', key: 'metadata' },
    { label: 'Type', key: 'spec' },
    { label: 'Min', key: 'spec' },
    { label: 'Max', key: 'spec' },
    { label: 'Default', key: 'spec' },
    { label: 'Default Request', key: 'spec' },
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

  const renderRow = (lr: V1LimitRange) => (
    <>
      <Td className="max-w-truncate align-middle" title={lr.metadata?.name ?? ''}>
        {lr.metadata?.name}
      </Td>
      <Td>
        <BadgeNamespaces name={lr.metadata?.namespace ?? ''} />
      </Td>
      <Td>{lr.spec?.limits?.map((l) => l.type).join(', ') || '-'}</Td>
      <Td>{renderLimitMap(lr.spec?.limits?.[0]?.min).display}</Td>
      <Td>{renderLimitMap(lr.spec?.limits?.[0]?.max).display}</Td>
      <Td>{renderLimitMap(lr.spec?.limits?.[0]?._default).display}</Td>
      <Td>{renderLimitMap(lr.spec?.limits?.[0]?.defaultRequest).display}</Td>
      <AgeCell timestamp={lr.metadata?.creationTimestamp ?? ''} />
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
