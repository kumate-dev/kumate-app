import { useMemo, useState, useCallback } from 'react';
import { V1Namespace } from '@kubernetes/client-node';
import { Td, Tr } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { ColumnDef } from '../../../../components/common/TableHeader';
import { PaneGeneric } from '../../generic/components/PaneGeneric';
import { BadgeStatus } from '../../generic/components/BadgeStatus';
import { getNamespaceStatus } from '../utils/namespaceStatus';
import { SidebarNamespaces } from './SidebarNamespaces';
import { sortItems } from '@/utils/sort';

export interface PaneNamespacesProps {
  items: V1Namespace[];
  loading: boolean;
  error: string;
  onDeleteNamespaces?: (namespaces: V1Namespace[]) => Promise<void>;
}

export default function PaneNamespaces({
  items,
  loading,
  error,
  onDeleteNamespaces,
}: PaneNamespacesProps) {
  const [sortBy, setSortBy] = useState<keyof V1Namespace>('metadata');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const handleDeleteSelected = useCallback(async (toDelete: V1Namespace[]) => {
    if (!toDelete.length || !onDeleteNamespaces) return;
    await onDeleteNamespaces(toDelete);
  }, [onDeleteNamespaces]);

  const columns: ColumnDef<string>[] = [
    { label: 'Name', key: 'name', sortable: true },
    { label: 'Age', key: 'age', sortable: true },
    { label: 'Status', key: 'status', sortable: true },
  ];

  const sortedItems = useMemo(() => {
    const valueGetters = {
      name: (item: V1Namespace) => item.metadata?.name || '',
      age: (item: V1Namespace) => new Date(item.metadata?.creationTimestamp || '').getTime(),
      status: (item: V1Namespace) => getNamespaceStatus(item),
    };
    return sortItems(items, sortBy as string, sortOrder, valueGetters);
  }, [items, sortBy, sortOrder]);

  const renderRow = (ns: V1Namespace) => (
    <Tr key={ns.metadata?.name}>
      <Td className="max-w-truncate" title={ns.metadata?.name}>
        {ns.metadata?.name}
      </Td>
      <AgeCell timestamp={ns.metadata?.creationTimestamp || ''} />
      <Td>
        <BadgeStatus status={getNamespaceStatus(ns)} />
      </Td>
    </Tr>
  );

  const renderSidebar = (
    item: V1Namespace,
    actions: {
      setItem: (item: V1Namespace | null) => void;
      onDelete?: (item: V1Namespace) => void;
      onEdit?: (item: V1Namespace) => void;
    }
  ) => (
    <SidebarNamespaces
      item={item}
      setItem={actions.setItem}
      onDelete={actions.onDelete}
      onEdit={actions.onEdit}
    />
  );

  return (
    <PaneGeneric
      items={sortedItems}
      loading={loading}
      error={error}
      showNamespace={false}
      columns={columns}
      sortBy={sortBy as string}
      sortOrder={sortOrder}
      setSortBy={(v) => setSortBy(v as keyof V1Namespace)}
      setSortOrder={setSortOrder}
      onDelete={handleDeleteSelected}
      colSpan={columns.length}
      renderRow={renderRow}
      renderSidebar={renderSidebar}
    />
  );
}
