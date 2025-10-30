import { useState, useCallback } from 'react';
import { V1HorizontalPodAutoscaler, V1Namespace } from '@kubernetes/client-node';
import { PaneResource } from '../../generic/components/PaneGeneric';
import { ColumnDef, TableHeader } from '../../../../components/common/TableHeader';
import { Td } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import { BadgeStatus } from '@/features/k8s/generic/components/BadgeStatus';
import { getHorizontalPodAutoscalerStatus } from '../utils/horizontalPodAutoscalersStatus';

export interface PaneHorizontalPodAutoscalersProps {
  selectedNamespaces: string[];
  onSelectNamespace: (namespaces: string[]) => void;
  namespaceList: V1Namespace[];
  items: V1HorizontalPodAutoscaler[];
  loading: boolean;
  error: string;
  onDeleteHorizontalPodAutoscalers: (hpas: V1HorizontalPodAutoscaler[]) => Promise<void>;
}

export default function PaneHorizontalPodAutoscalers({
  selectedNamespaces,
  onSelectNamespace,
  namespaceList,
  items,
  loading,
  error,
  onDeleteHorizontalPodAutoscalers,
}: PaneHorizontalPodAutoscalersProps) {
  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState<keyof V1HorizontalPodAutoscaler>('metadata');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedItems, setSelectedItems] = useState<V1HorizontalPodAutoscaler[]>([]);

  const toggleItem = useCallback((item: V1HorizontalPodAutoscaler) => {
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
    await onDeleteHorizontalPodAutoscalers(selectedItems);
    setSelectedItems([]);
  }, [selectedItems, onDeleteHorizontalPodAutoscalers]);

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
      totalItems={items}
    />
  );

  const renderRow = (hpa: V1HorizontalPodAutoscaler) => (
    <>
      <Td className="max-w-truncate align-middle">
        <span className="block truncate" title={hpa.metadata?.name ?? ''}>
          {hpa.metadata?.name}
        </span>
      </Td>
      <Td>
        <BadgeNamespaces name={hpa.metadata?.namespace ?? ''} />
      </Td>
      <Td>{hpa.spec?.scaleTargetRef?.name ?? '-'}</Td>
      <Td>{hpa.spec?.minReplicas ?? '-'}</Td>
      <Td>{hpa.spec?.maxReplicas ?? '-'}</Td>
      <Td>{hpa.status?.currentReplicas ?? '-'}</Td>
      <Td>{hpa.status?.desiredReplicas ?? '-'}</Td>
      <AgeCell timestamp={hpa.metadata?.creationTimestamp ?? ''} />
      <Td>
        <BadgeStatus status={getHorizontalPodAutoscalerStatus(hpa)} />
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
