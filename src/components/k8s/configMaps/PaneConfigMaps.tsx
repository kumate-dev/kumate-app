import { useState, useCallback } from 'react';
import { V1ConfigMap } from '@kubernetes/client-node';
import { useNamespaceStore } from '@/store/namespaceStore';
import { useSelectedNamespaces } from '@/hooks/useSelectedNamespaces';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import { listConfigMaps, watchConfigMaps, deleteConfigMaps } from '@/api/k8s/configMaps';
import { Td } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { useFilteredItems } from '@/hooks/useFilteredItems';
import { useDeleteK8sResources } from '@/hooks/useDeleteK8sResources';
import { toast } from 'sonner';
import { PaneResource, PaneResourceContextProps } from '../shared/PaneGeneric';
import { ColumnDef, TableHeader } from '@/components/common/TableHeader';
import { BadgeK8sNamespaces } from '../shared/BadgeNamespaces';

export default function PaneConfigMaps({ context }: PaneResourceContextProps) {
  const selectedNamespaces = useNamespaceStore((s) => s.selectedNamespaces);
  const setSelectedNamespaces = useNamespaceStore((s) => s.setSelectedNamespaces);
  const namespaceList = useSelectedNamespaces(context);

  const { items, loading, error } = useListK8sResources<V1ConfigMap>(
    listConfigMaps,
    watchConfigMaps,
    context,
    selectedNamespaces
  );

  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState<keyof V1ConfigMap>('metadata');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedItems, setSelectedItems] = useState<V1ConfigMap[]>([]);

  const filtered = useFilteredItems(
    items,
    selectedNamespaces,
    q,
    ['metadata.name', 'metadata.namespace', 'data'],
    'metadata.name',
    'asc'
  );

  const { handleDeleteResources } = useDeleteK8sResources<V1ConfigMap>(deleteConfigMaps, context);

  const toggleItem = useCallback((item: V1ConfigMap) => {
    setSelectedItems((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  }, []);

  const toggleAll = useCallback(
    (checked: boolean) => {
      setSelectedItems(checked ? [...filtered] : []);
    },
    [filtered]
  );

  const handleDeleteSelected = useCallback(async () => {
    if (selectedItems.length === 0) return toast.error('No ConfigMaps selected');
    await handleDeleteResources(selectedItems);
    setSelectedItems([]);
  }, [selectedItems, handleDeleteResources]);

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
      totalItems={filtered}
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
        <BadgeK8sNamespaces name={cm.metadata?.namespace ?? ''} />
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
