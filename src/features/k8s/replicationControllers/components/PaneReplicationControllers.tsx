import { useCallback, useMemo, useState } from 'react';
import { V1ReplicationController, V1Namespace } from '@kubernetes/client-node';
import { Td } from '@/components/ui/table';
import { PaneGeneric } from '../../generic/components/PaneGeneric';
import { ColumnDef } from '../../../../components/common/TableHeader';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import AgeCell from '@/components/common/AgeCell';
import { getReplicationControllerStatus } from '../utils/replicationControllerStatus';
import { BadgeStatus } from '../../generic/components/BadgeStatus';
import { sortItems } from '@/utils/sort';
import { SidebarReplicationControllers } from './SidebarReplicationControllers';

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
  const [sortBy, setSortBy] = useState<string>('name');
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

  const columns: ColumnDef<string>[] = [
    { label: 'Name', key: 'name', sortable: true },
    { label: 'Namespace', key: 'namespace', sortable: true },
    { label: 'Ready', key: 'status', sortable: true },
    { label: 'Age', key: 'age', sortable: true },
  ];

  const sortedItems = useMemo(() => {
    const valueGetters = {
      name: (item: V1ReplicationController) => item.metadata?.name || '',
      namespace: (item: V1ReplicationController) => item.metadata?.namespace || '',
      status: (item: V1ReplicationController) => getReplicationControllerStatus(item),
      age: (item: V1ReplicationController) => new Date(item.metadata?.creationTimestamp || '').getTime(),
    };
    return sortItems(items, sortBy, sortOrder, valueGetters);
  }, [items, sortBy, sortOrder]);

  const renderRow = (rc: V1ReplicationController) => {
    return (
      <>
        <Td className="max-w-truncate align-middle">
          <span className="block truncate" title={rc.metadata?.name}>
            {rc.metadata?.name}
          </span>
        </Td>
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

  const renderSidebar = useCallback(
    (
      item: V1ReplicationController,
      actions: {
        setItem: (item: V1ReplicationController | null) => void;
        onDelete?: (item: V1ReplicationController) => void;
        onEdit?: (item: V1ReplicationController) => void;
      }
    ) => (
      <SidebarReplicationControllers
        item={item}
        setItem={actions.setItem}
        onDelete={actions.onDelete}
        // ReplicationControllers do not support edit via YAML yet
        onEdit={undefined}
      />
    ),
    []
  );

  return (
    <PaneGeneric
      items={sortedItems}
      loading={loading}
      error={error}
      namespaceList={namespaceList}
      selectedNamespaces={selectedNamespaces}
      onSelectNamespace={onSelectNamespace}
      columns={columns}
      renderRow={renderRow}
      emptyText="No replication controllers found"
      onDelete={handleDeleteSelected}
      renderSidebar={renderSidebar}
      sortBy={sortBy}
      sortOrder={sortOrder}
      setSortBy={setSortBy}
      setSortOrder={setSortOrder}
    />
  );
}
