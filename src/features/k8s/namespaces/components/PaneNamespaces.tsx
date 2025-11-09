import { useMemo, useState } from 'react';
import { V1Namespace } from '@kubernetes/client-node';
import { Td } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { ColumnDef } from '../../../../components/common/TableHeader';
import { PaneGeneric } from '../../generic/components/PaneGeneric';
import { BadgeStatus } from '../../generic/components/BadgeStatus';
import { getNamespaceStatus } from '../utils/namespaceStatus';
import { SidebarNamespaces } from './SidebarNamespaces';
import { templateNamespace } from '../../templates/namespace';
import { useOptimisticSortedItems } from '@/hooks/useOptimisticSortedItems';

export interface PaneNamespacesProps {
  items: V1Namespace[];
  loading: boolean;
  error: string;
  onDelete?: (namespaces: V1Namespace[]) => Promise<void>;
  contextName?: string;
  deleting?: boolean;
  onCreate?: (manifest: V1Namespace) => Promise<V1Namespace | undefined>;
  onUpdate?: (manifest: V1Namespace) => Promise<V1Namespace | undefined>;
  creating?: boolean;
  updating?: boolean;
}

export default function PaneNamespaces({
  items,
  loading,
  error,
  onDelete,
  contextName,
  deleting = false,
  onCreate,
  onUpdate,
  creating = false,
  updating = false,
}: PaneNamespacesProps) {
  const [sortBy, setSortBy] = useState<keyof V1Namespace>('metadata');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const valueGetters = useMemo(
    () => ({
      name: (item: V1Namespace) => item.metadata?.name || '',
      age: (item: V1Namespace) => new Date(item.metadata?.creationTimestamp || '').getTime(),
      status: (item: V1Namespace) => getNamespaceStatus(item).status,
    }),
    []
  );

  const { sortedItems, onAfterCreate } = useOptimisticSortedItems<V1Namespace>({
    items,
    sortBy: sortBy as string,
    sortOrder,
    valueGetters,
    isNamespaced: false,
  });

  const columns: ColumnDef<string>[] = [
    { label: 'Name', key: 'name', sortable: true },
    { label: 'Age', key: 'age', sortable: true },
    { label: 'Status', key: 'status', sortable: true },
  ];

  const renderRow = (ns: V1Namespace) => (
    <>
      <Td className="max-w-truncate" title={ns.metadata?.name}>
        {ns.metadata?.name}
      </Td>
      <AgeCell timestamp={ns.metadata?.creationTimestamp || ''} />
      <Td>
        <BadgeStatus status={getNamespaceStatus(ns)} />
      </Td>
    </>
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
      updating={updating}
      deleting={deleting}
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
      onDelete={onDelete}
      colSpan={columns.length}
      renderRow={renderRow}
      renderSidebar={renderSidebar}
      yamlTemplate={() => templateNamespace}
      contextName={contextName}
      onCreate={onCreate}
      onUpdate={onUpdate}
      onAfterCreate={onAfterCreate}
      creating={creating}
      deleting={deleting}
    />
  );
}
