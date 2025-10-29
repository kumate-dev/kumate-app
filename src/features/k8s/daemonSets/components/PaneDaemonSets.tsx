import { useState, useCallback } from 'react';
import { V1DaemonSet, V1Namespace } from '@kubernetes/client-node';
import { PaneResource } from '../../common/components/PaneGeneric';
import { ColumnDef, TableHeader } from '../../../../components/common/TableHeader';
import { Td } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import AgeCell from '@/components/common/AgeCell';
import { readyVariant } from '@/utils/k8s';
import { BadgeVariant } from '@/types/variant';
import { BadgeNamespaces } from '../../common/components/BadgeNamespaces';
import { daemonSetHasWarning } from '../utils/daemonSetHasWarning';
import { Warning } from '@/components/common/Warning';

export interface PaneDaemonSetsProps {
  selectedNamespaces: string[];
  onSelectNamespace: (namespaces: string[]) => void;
  namespaceList: V1Namespace[];
  items: V1DaemonSet[];
  loading: boolean;
  error: string;
  onDeleteDaemonSets: (daemonSets: V1DaemonSet[]) => Promise<void>;
}

export default function PaneDaemonSets({
  selectedNamespaces,
  onSelectNamespace,
  namespaceList,
  items,
  loading,
  error,
  onDeleteDaemonSets,
}: PaneDaemonSetsProps) {
  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState<keyof V1DaemonSet>('metadata');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedItems, setSelectedItems] = useState<V1DaemonSet[]>([]);

  const toggleItem = useCallback((ds: V1DaemonSet) => {
    setSelectedItems((prev) => (prev.includes(ds) ? prev.filter((d) => d !== ds) : [...prev, ds]));
  }, []);

  const toggleAll = useCallback(
    (checked: boolean) => {
      setSelectedItems(checked ? [...items] : []);
    },
    [items]
  );

  const handleDeleteSelected = useCallback(async () => {
    if (selectedItems.length === 0) return;
    await onDeleteDaemonSets(selectedItems);
    setSelectedItems([]);
  }, [selectedItems, onDeleteDaemonSets]);

  const columns: ColumnDef<keyof V1DaemonSet | ''>[] = [
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

  const renderRow = (ds: V1DaemonSet) => (
    <>
      <Td className="max-w-truncate align-middle">
        <span className="block truncate" title={ds.metadata?.name}>
          {ds.metadata?.name}
        </span>
      </Td>
      <Td className="text-center align-middle">{daemonSetHasWarning(ds) && <Warning />}</Td>
      <Td>
        <BadgeNamespaces name={ds.metadata?.namespace ?? ''} />
      </Td>
      <Td>
        <Badge
          variant={
            readyVariant(
              `${ds.status?.numberReady ?? 0}/${ds.status?.desiredNumberScheduled ?? 0}`
            ) as BadgeVariant
          }
        >
          {ds.status?.numberReady ?? 0} / {ds.status?.desiredNumberScheduled ?? 0}
        </Badge>
      </Td>
      <AgeCell timestamp={ds.metadata?.creationTimestamp ?? ''} />
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
