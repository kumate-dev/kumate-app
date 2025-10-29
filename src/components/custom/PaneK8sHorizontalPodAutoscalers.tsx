import { useState, useCallback } from 'react';
import { V1HorizontalPodAutoscaler } from '@kubernetes/client-node';
import { PaneK8sResource, PaneK8sResourceContextProps } from './PaneK8sResource';
import { useNamespaceStore } from '@/store/namespaceStore';
import { useSelectedNamespaces } from '@/hooks/useSelectedNamespaces';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import {
  listHorizontalPodAutoscalers,
  watchHorizontalPodAutoscalers,
  deleteHorizontalPodAutoscalers,
} from '@/api/k8s/horizontalPodAutoscalers';
import { ColumnDef, TableHeader } from './TableHeader';
import { Td } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import AgeCell from '@/components/custom/AgeCell';
import { useFilteredItems } from '@/hooks/useFilteredItems';
import { BadgeK8sNamespaces } from './BadgeK8sNamespaces';
import { useDeleteK8sResources } from '@/hooks/useDeleteK8sResources';
import { toast } from 'sonner';

export default function PaneK8sHorizontalPodAutoscalers({ context }: PaneK8sResourceContextProps) {
  const selectedNamespaces = useNamespaceStore((s) => s.selectedNamespaces);
  const setSelectedNamespaces = useNamespaceStore((s) => s.setSelectedNamespaces);
  const namespaceList = useSelectedNamespaces(context);

  const { items, loading, error } = useListK8sResources<V1HorizontalPodAutoscaler>(
    listHorizontalPodAutoscalers,
    watchHorizontalPodAutoscalers,
    context,
    selectedNamespaces
  );

  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState<keyof V1HorizontalPodAutoscaler>('metadata');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedItems, setSelectedItems] = useState<V1HorizontalPodAutoscaler[]>([]);

  const filtered = useFilteredItems(
    items,
    selectedNamespaces,
    q,
    ['metadata.name', 'metadata.namespace', 'spec.scaleTargetRef.name'],
    'metadata.name',
    'asc'
  );

  const { handleDeleteResources } = useDeleteK8sResources<V1HorizontalPodAutoscaler>(
    deleteHorizontalPodAutoscalers,
    context
  );

  const toggleItem = useCallback((item: V1HorizontalPodAutoscaler) => {
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
    if (selectedItems.length === 0) return toast.error('No HPAs selected');
    await handleDeleteResources(selectedItems);
    setSelectedItems([]);
  }, [selectedItems, handleDeleteResources]);

  const statusVariant = (status?: string) => {
    switch (status) {
      case 'Active':
      case 'AbleToScale':
        return 'success';
      case 'Error':
      case 'Failed':
        return 'error';
      case 'Unknown':
      default:
        return 'default';
    }
  };

  const columns: ColumnDef<keyof V1HorizontalPodAutoscaler | ''>[] = [
    { label: 'Name', key: 'metadata' },
    { label: 'Namespace', key: 'metadata' },
    { label: 'Target', key: 'spec' },
    { label: 'Min', key: 'spec' },
    { label: 'Max', key: 'spec' },
    { label: 'Current', key: 'status' },
    { label: 'Desired', key: 'status' },
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
      totalItems={filtered}
    />
  );

  const status = (hpa: V1HorizontalPodAutoscaler): string => {
    const conditions = (hpa.status as any)?.conditions as
      | { type?: string; status?: string }[]
      | undefined;
    if (!conditions || conditions.length === 0) return 'Unknown';

    for (const cond of conditions) {
      const type = cond.type;
      const status = cond.status;

      if (type === 'ScalingActive' && status === 'True') return 'Active';
      if (type === 'ScalingActive' && status === 'False') return 'Error';
      if (type === 'AbleToScale' && status === 'True') return 'AbleToScale';
      if (type === 'AbleToScale' && status === 'False') return 'Failed';
    }

    return 'Unknown';
  };

  const renderRow = (hpa: V1HorizontalPodAutoscaler) => (
    <>
      <Td className="max-w-truncate align-middle">
        <span className="block truncate" title={hpa.metadata?.name ?? ''}>
          {hpa.metadata?.name}
        </span>
      </Td>
      <Td>
        <BadgeK8sNamespaces name={hpa.metadata?.namespace ?? ''} />
      </Td>
      <Td>{hpa.spec?.scaleTargetRef?.name ?? '-'}</Td>
      <Td>{hpa.spec?.minReplicas ?? '-'}</Td>
      <Td>{hpa.spec?.maxReplicas ?? '-'}</Td>
      <Td>{hpa.status?.currentReplicas ?? '-'}</Td>
      <Td>{hpa.status?.desiredReplicas ?? '-'}</Td>
      <AgeCell timestamp={hpa.metadata?.creationTimestamp ?? ''} />
      <Td>
        <Badge variant={statusVariant(status(hpa))}>{status(hpa)}</Badge>
      </Td>
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
