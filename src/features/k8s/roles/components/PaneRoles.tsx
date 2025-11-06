import { useCallback, useMemo, useState } from 'react';
import type { V1Role, V1Namespace } from '@kubernetes/client-node';
import { Td } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { PaneGeneric } from '../../generic/components/PaneGeneric';
import { SidebarRoles } from './SidebarRoles';
import { ColumnDef } from '@/components/common/TableHeader';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import { sortItems } from '@/utils/sort';

export interface PaneRolesProps {
  items: V1Role[];
  loading: boolean;
  error: string;
  namespaceList?: V1Namespace[];
  selectedNamespaces?: string[];
  onSelectNamespace?: (ns: string[]) => void;
  onDelete: (items: V1Role[]) => Promise<void>;
  onCreate?: (manifest: V1Role) => Promise<V1Role | undefined>;
  onUpdate?: (manifest: V1Role) => Promise<V1Role | undefined>;
  contextName?: string;
  creating?: boolean;
  updating?: boolean;
  deleting?: boolean;
}

export default function PaneRoles({
  items,
  loading,
  error,
  namespaceList,
  selectedNamespaces,
  onSelectNamespace,
  onDelete,
  onCreate,
  onUpdate,
  contextName,
  creating = false,
  updating = false,
  deleting = false,
}: PaneRolesProps) {
  const [sortBy, setSortBy] = useState<string>('metadata.name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const columns: ColumnDef<string>[] = [
    { key: 'metadata.name', label: 'Name' },
    { key: 'metadata.namespace', label: 'Namespace' },
    { key: 'rules', label: 'Rules' },
    { key: 'metadata.creationTimestamp', label: 'Age' },
  ];

  const valueGetters = useMemo(
    () =>
      ({
        rules: (r: V1Role) => String((r.rules || []).length),
      }) as const,
    []
  );

  const sortedItems = useMemo(() => {
    return sortItems(items, sortBy, sortOrder, valueGetters);
  }, [items, sortBy, sortOrder, valueGetters]);

  const handleDeleteSelected = useCallback(
    async (selected: V1Role[]) => {
      await onDelete(selected);
    },
    [onDelete]
  );

  const renderRow = (role: V1Role) => (
    <>
      <Td className="max-w-truncate align-middle">
        <span className="block truncate" title={role.metadata?.name ?? ''}>
          {role.metadata?.name}
        </span>
      </Td>
      <Td>
        <BadgeNamespaces name={role.metadata?.namespace ?? ''} />
      </Td>
      <Td>{(role.rules || []).length}</Td>
      <AgeCell timestamp={role.metadata?.creationTimestamp ?? ''} />
    </>
  );

  const renderSidebar = (
    item: V1Role,
    actions: {
      setItem: (item: V1Role | null) => void;
      onDelete?: (item: V1Role) => void;
      onEdit?: (item: V1Role) => void;
    }
  ) => (
    <SidebarRoles
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
      namespaceList={namespaceList}
      selectedNamespaces={selectedNamespaces}
      onSelectNamespace={onSelectNamespace}
      columns={columns}
      renderRow={renderRow}
      emptyText="No roles found"
      onDelete={handleDeleteSelected}
      onCreate={onCreate}
      onUpdate={onUpdate}
      renderSidebar={renderSidebar}
      sortBy={sortBy}
      sortOrder={sortOrder}
      setSortBy={setSortBy}
      setSortOrder={setSortOrder}
      contextName={contextName}
      creating={creating}
      deleting={deleting}
    />
  );
}
