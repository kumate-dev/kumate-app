import { useState, useCallback } from 'react';
import { V1LimitRange } from '@kubernetes/client-node';
import { PaneK8sResource, PaneK8sResourceContextProps } from './PaneK8sResource';
import { useNamespaceStore } from '@/store/namespaceStore';
import { useSelectedNamespaces } from '@/hooks/useSelectedNamespaces';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import { listLimitRanges, watchLimitRanges, deleteLimitRanges } from '@/api/k8s/limitRanges';
import { ColumnDef, TableHeader } from './TableHeader';
import { Td } from '@/components/ui/table';
import AgeCell from '@/components/custom/AgeCell';
import { BadgeK8sNamespaces } from './BadgeK8sNamespaces';
import { useFilteredItems } from '@/hooks/useFilteredItems';
import { useDeleteK8sResources } from '@/hooks/useDeleteK8sResources';
import { toast } from 'sonner';

export default function PaneK8sLimitRanges({ context }: PaneK8sResourceContextProps) {
  const selectedNamespaces = useNamespaceStore((s) => s.selectedNamespaces);
  const setSelectedNamespaces = useNamespaceStore((s) => s.setSelectedNamespaces);
  const namespaceList = useSelectedNamespaces(context);

  const { items, loading, error } = useListK8sResources<V1LimitRange>(
    listLimitRanges,
    watchLimitRanges,
    context,
    selectedNamespaces
  );

  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState<keyof V1LimitRange>('metadata');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedItems, setSelectedItems] = useState<V1LimitRange[]>([]);

  const filtered = useFilteredItems(
    items,
    selectedNamespaces,
    q,
    ['metadata.name', 'metadata.namespace'],
    'metadata.name',
    'asc'
  );

  const { handleDeleteResources } = useDeleteK8sResources<V1LimitRange>(deleteLimitRanges, context);

  const toggleItem = useCallback((lr: V1LimitRange) => {
    setSelectedItems((prev) => (prev.includes(lr) ? prev.filter((i) => i !== lr) : [...prev, lr]));
  }, []);

  const toggleAll = useCallback(
    (checked: boolean) => setSelectedItems(checked ? [...filtered] : []),
    [filtered]
  );

  const handleDeleteSelected = useCallback(async () => {
    if (!selectedItems.length) return toast.error('No limit ranges selected');
    await handleDeleteResources(selectedItems);
    setSelectedItems([]);
  }, [selectedItems, handleDeleteResources]);

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
      totalItems={filtered}
    />
  );

  const renderRow = (lr: V1LimitRange) => (
    <>
      <Td className="max-w-truncate align-middle" title={lr.metadata?.name ?? ''}>
        {lr.metadata?.name}
      </Td>
      <Td>
        <BadgeK8sNamespaces name={lr.metadata?.namespace ?? ''} />
      </Td>
      <Td>{lr.spec?.limits?.map((l) => l.type).join(', ') || '-'}</Td>
      <Td>{renderLimitMap(lr.spec?.limits?.[0]?.min).display}</Td>
      <Td>{renderLimitMap(lr.spec?.limits?.[0]?.max).display}</Td>
      <Td>{renderLimitMap(lr.spec?.limits?.[0]?._default).display}</Td>
      <Td>{renderLimitMap(lr.spec?.limits?.[0]?.defaultRequest).display}</Td>
      <AgeCell timestamp={lr.metadata?.creationTimestamp ?? ''} />
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
      selectedItems={selectedItems}
      onToggleItem={toggleItem}
      onDeleteSelected={handleDeleteSelected}
      colSpan={columns.length + 1}
      tableHeader={tableHeader}
      renderRow={renderRow}
    />
  );
}
