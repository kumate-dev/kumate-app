import { useCallback, useMemo, useState } from 'react';
import type { V1ClusterRole } from '@kubernetes/client-node';
import { Td } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { PaneGeneric } from '../../generic/components/PaneGeneric';
import { SidebarClusterRoles } from './SidebarClusterRoles';
import { ColumnDef } from '@/components/common/TableHeader';
import { sortItems } from '@/utils/sort';
import { templateClusterRole } from '../../templates/clusterRole';

export interface PaneClusterRolesProps {
  items: V1ClusterRole[];
  loading: boolean;
  error: string;
  onDelete: (items: V1ClusterRole[]) => Promise<void>;
  onCreate?: (manifest: V1ClusterRole) => Promise<V1ClusterRole | undefined>;
  onUpdate?: (manifest: V1ClusterRole) => Promise<V1ClusterRole | undefined>;
  contextName?: string;
  creating?: boolean;
  updating?: boolean;
  deleting?: boolean;
}

export default function PaneClusterRoles({
  items,
  loading,
  error,
  onDelete,
  onCreate,
  onUpdate,
  contextName,
  creating,
  updating,
  deleting,
}: PaneClusterRolesProps) {
  const [sortBy, setSortBy] = useState<string>('metadata.name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const columns: ColumnDef<string>[] = [
    { key: 'metadata.name', label: 'Name' },
    { key: 'rules', label: 'Rules' },
    { key: 'metadata.creationTimestamp', label: 'Age' },
  ];

  const valueGetters = useMemo(
    () =>
      ({
        rules: (r: V1ClusterRole) => String((r.rules || []).length),
      }) as const,
    []
  );

  const sortedItems = useMemo(() => {
    return sortItems(items, sortBy, sortOrder, valueGetters);
  }, [items, sortBy, sortOrder, valueGetters]);

  const renderRow = (role: V1ClusterRole) => (
    <>
      <Td className="max-w-truncate align-middle">
        <span className="block truncate" title={role.metadata?.name ?? ''}>
          {role.metadata?.name}
        </span>
      </Td>
      <Td>{(role.rules || []).length}</Td>
      <AgeCell timestamp={role.metadata?.creationTimestamp ?? ''} />
    </>
  );

  const renderSidebar = useCallback(
    (
      item: V1ClusterRole,
      actions: {
        setItem: (item: V1ClusterRole | null) => void;
        onDelete?: (item: V1ClusterRole) => void;
        onEdit?: (item: V1ClusterRole) => void;
      }
    ) => (
      <SidebarClusterRoles
        item={item}
        setItem={actions.setItem}
        onDelete={actions.onDelete}
        onEdit={actions.onEdit}
        contextName={contextName}
        updating={updating ?? false}
        deleting={deleting ?? false}
      />
    ),
    [updating, deleting, contextName]
  );

  return (
    <PaneGeneric
      items={sortedItems}
      loading={loading}
      error={error}
      showNamespace={false}
      columns={columns}
      renderRow={renderRow}
      emptyText="No cluster roles found"
      onDelete={onDelete}
      onCreate={onCreate}
      onUpdate={onUpdate}
      yamlTemplate={() => templateClusterRole()}
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
