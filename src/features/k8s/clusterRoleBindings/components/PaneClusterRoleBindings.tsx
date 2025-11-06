import { useCallback, useMemo, useState } from 'react';
import type { V1ClusterRoleBinding } from '@kubernetes/client-node';
import { Td } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { PaneGeneric } from '../../generic/components/PaneGeneric';
import { SidebarClusterRoleBindings } from './SidebarClusterRoleBindings';
import { ColumnDef } from '@/components/common/TableHeader';
import { sortItems } from '@/utils/sort';

export interface PaneClusterRoleBindingsProps {
  items: V1ClusterRoleBinding[];
  loading: boolean;
  error: string;
  onDeleteClusterRoleBindings: (items: V1ClusterRoleBinding[]) => Promise<void>;
  onCreate?: (manifest: V1ClusterRoleBinding) => Promise<V1ClusterRoleBinding | undefined>;
  onUpdate?: (manifest: V1ClusterRoleBinding) => Promise<V1ClusterRoleBinding | undefined>;
  contextName?: string;
}

export default function PaneClusterRoleBindings({
  items,
  loading,
  error,
  onDeleteClusterRoleBindings,
  onCreate,
  onUpdate,
  contextName,
}: PaneClusterRoleBindingsProps) {
  const [sortBy, setSortBy] = useState<string>('metadata.name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const columns: ColumnDef<string>[] = [
    { key: 'metadata.name', label: 'Name' },
    { key: 'subjects', label: 'Subjects' },
    { key: 'roleRef', label: 'Role Ref' },
    { key: 'metadata.creationTimestamp', label: 'Age' },
  ];

  const valueGetters = useMemo(
    () =>
      ({
        subjects: (rb: V1ClusterRoleBinding) => String((rb.subjects || []).length),
        roleRef: (rb: V1ClusterRoleBinding) => rb.roleRef?.name || '-',
      }) as const,
    []
  );

  const sortedItems = useMemo(() => {
    return sortItems(items, sortBy, sortOrder, valueGetters);
  }, [items, sortBy, sortOrder, valueGetters]);

  const handleDeleteSelected = useCallback(
    async (selected: V1ClusterRoleBinding[]) => {
      await onDeleteClusterRoleBindings(selected);
    },
    [onDeleteClusterRoleBindings]
  );

  const renderRow = (rb: V1ClusterRoleBinding) => (
    <>
      <Td className="max-w-truncate align-middle">
        <span className="block truncate" title={rb.metadata?.name ?? ''}>
          {rb.metadata?.name}
        </span>
      </Td>
      <Td>{(rb.subjects || []).length}</Td>
      <Td>{rb.roleRef?.name || '-'}</Td>
      <AgeCell timestamp={rb.metadata?.creationTimestamp ?? ''} />
    </>
  );

  const renderSidebar = (
    item: V1ClusterRoleBinding,
    actions: {
      setItem: (item: V1ClusterRoleBinding | null) => void;
      onDelete?: (item: V1ClusterRoleBinding) => void;
      onEdit?: (item: V1ClusterRoleBinding) => void;
    }
  ) => (
    <SidebarClusterRoleBindings
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
      renderRow={renderRow}
      emptyText="No cluster role bindings found"
      onDelete={handleDeleteSelected}
      onCreate={onCreate}
      onUpdate={onUpdate}
      renderSidebar={renderSidebar}
      sortBy={sortBy}
      sortOrder={sortOrder}
      setSortBy={setSortBy}
      setSortOrder={setSortOrder}
      contextName={contextName}
    />
  );
}
