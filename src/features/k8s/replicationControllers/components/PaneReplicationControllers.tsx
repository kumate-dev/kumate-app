import { useState, useCallback } from 'react';
import { V1ReplicationController, V1Namespace } from '@kubernetes/client-node';
import { Td } from '@/components/ui/table';
import { PaneResource } from '../../common/components/PaneGeneric';
import { ColumnDef, TableHeader } from '../../../../components/common/TableHeader';
import { BadgeNamespaces } from '../../common/components/BadgeNamespaces';
import AgeCell from '@/components/common/AgeCell';
import { Badge } from '@/components/ui/badge';
import { K8sStatus } from '@/types/k8sStatus';
import { BadgeVariant } from '@/types/variant';
import { getReplicationControllerStatus } from '../utils/replicationControllerStatus';
import { BadgeStatus } from '../../common/components/BadgeStatus';

export interface PaneReplicationControllersProps {
  selectedNamespaces: string[];
  onSelectNamespace: (namespaces: string[]) => void;
  namespaceList: V1Namespace[];
  items: V1ReplicationController[];
  loading: boolean;
  error: string;
  onDeleteReplicationControllers: (
    replicationControllers: V1ReplicationController[]
  ) => Promise<void>;
}

export default function PaneReplicationControllers({
  selectedNamespaces,
  onSelectNamespace,
  namespaceList,
  items,
  loading,
  error,
  onDeleteReplicationControllers,
}: PaneReplicationControllersProps) {
  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState<keyof V1ReplicationController>('metadata');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedItems, setSelectedItems] = useState<V1ReplicationController[]>([]);

  const toggleItem = useCallback((rc: V1ReplicationController) => {
    setSelectedItems((prev) => (prev.includes(rc) ? prev.filter((r) => r !== rc) : [...prev, rc]));
  }, []);

  const toggleAll = useCallback(
    (checked: boolean) => {
      setSelectedItems(checked ? [...items] : []);
    },
    [items]
  );

  const handleDeleteSelected = useCallback(async () => {
    if (!selectedItems.length) return;
    await onDeleteReplicationControllers(selectedItems);
    setSelectedItems([]);
  }, [selectedItems, onDeleteReplicationControllers]);

  const columns: ColumnDef<keyof V1ReplicationController | ''>[] = [
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

  const renderRow = (rc: V1ReplicationController) => {
    return (
      <>
        <Td className="max-w-truncate align-middle">
          <span className="block truncate" title={rc.metadata?.name}>
            {rc.metadata?.name}
          </span>
        </Td>
        <Td />
        <Td>
          <BadgeNamespaces name={rc.metadata?.namespace ?? ''} />
        </Td>
        <Td>
          <BadgeStatus status={getReplicationControllerStatus(rc)} />
        </Td>
        <AgeCell timestamp={rc.metadata?.creationTimestamp ?? ''} />
      </>
    );
  };

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
