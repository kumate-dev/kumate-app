import { useState, useCallback } from 'react';
import { Td } from '@/components/ui/table';
import { PaneK8sResource, PaneK8sResourceContextProps } from '../shared/PaneK8sResource';
import { useNamespaceStore } from '@/store/namespaceStore';
import { useSelectedNamespaces } from '@/hooks/useSelectedNamespaces';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import {
  listResourceQuotas,
  watchResourceQuotas,
  deleteResourceQuotas,
} from '@/api/k8s/resourceQuotas';
import { V1ResourceQuota } from '@kubernetes/client-node';
import { useFilteredItems } from '@/hooks/useFilteredItems';
import { ColumnDef, TableHeader } from '../../common/TableHeader';
import { BadgeK8sNamespaces } from '../shared/BadgeK8sNamespaces';
import AgeCell from '@/components/common/AgeCell';
import { useDeleteK8sResources } from '@/hooks/useDeleteK8sResources';
import { toast } from 'sonner';

export default function PaneK8sResourceQuotas({ context }: PaneK8sResourceContextProps) {
  const selectedNamespaces = useNamespaceStore((s) => s.selectedNamespaces);
  const setSelectedNamespaces = useNamespaceStore((s) => s.setSelectedNamespaces);
  const namespaceList = useSelectedNamespaces(context);

  const { items, loading, error } = useListK8sResources<V1ResourceQuota>(
    listResourceQuotas,
    watchResourceQuotas,
    context,
    selectedNamespaces
  );

  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState<keyof V1ResourceQuota>('metadata');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedQuotas, setSelectedQuotas] = useState<V1ResourceQuota[]>([]);

  const filtered = useFilteredItems(
    items,
    selectedNamespaces,
    q,
    ['metadata.name', 'metadata.namespace'],
    sortBy,
    sortOrder
  );

  const { handleDeleteResources } = useDeleteK8sResources<V1ResourceQuota>(
    deleteResourceQuotas,
    context
  );

  const toggleQuota = useCallback((rq: V1ResourceQuota) => {
    setSelectedQuotas((prev) => (prev.includes(rq) ? prev.filter((r) => r !== rq) : [...prev, rq]));
  }, []);

  const toggleAllQuotas = useCallback(
    (checked: boolean) => setSelectedQuotas(checked ? [...filtered] : []),
    [filtered]
  );

  const handleDeleteSelected = useCallback(async () => {
    if (!selectedQuotas.length) return toast.error('No ResourceQuotas selected');
    await handleDeleteResources(selectedQuotas);
    setSelectedQuotas([]);
  }, [selectedQuotas, handleDeleteResources]);

  const renderKeyValue = (map?: Record<string, string | number>) => {
    if (!map || Object.keys(map).length === 0) return { display: '-', title: '-' };
    const text = Object.entries(map)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    return { display: text, title: text };
  };

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
      onToggleAll={toggleAllQuotas}
      selectedItems={selectedQuotas}
      totalItems={filtered}
    />
  );

  const renderRow = (rq: V1ResourceQuota) => (
    <>
      <Td className="max-w-truncate align-middle">
        <span className="block truncate" title={rq.metadata?.name}>
          {rq.metadata?.name}
        </span>
      </Td>
      <Td>
        <BadgeK8sNamespaces name={rq.metadata?.namespace ?? ''} />
      </Td>
      <Td
        className="max-w-truncate"
        title={renderKeyValue(rq.status?.hard as Record<string, string>).title}
      >
        {renderKeyValue(rq.status?.hard as Record<string, string>).display}
      </Td>
      <Td
        className="max-w-truncate"
        title={renderKeyValue(rq.status?.used as Record<string, string>).title}
      >
        {renderKeyValue(rq.status?.used as Record<string, string>).display}
      </Td>
      <AgeCell timestamp={rq.metadata?.creationTimestamp ?? ''} />
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
      selectedItems={selectedQuotas}
      onToggleItem={toggleQuota}
      onToggleAll={toggleAllQuotas}
      onDeleteSelected={handleDeleteSelected}
      colSpan={columns.length + 1}
      tableHeader={tableHeader}
      renderRow={renderRow}
    />
  );
}
