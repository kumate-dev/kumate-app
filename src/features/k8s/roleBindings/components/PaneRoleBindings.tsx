import { useCallback, useMemo, useState } from 'react';
import type { V1RoleBinding, V1Namespace } from '@kubernetes/client-node';
import { Td } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { PaneGeneric } from '../../generic/components/PaneGeneric';
import { ColumnDef } from '@/components/common/TableHeader';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import { sortItems } from '@/utils/sort';

export interface PaneRoleBindingsProps {
  items: V1RoleBinding[];
  loading: boolean;
  error: string;
  namespaceList?: V1Namespace[];
  selectedNamespaces?: string[];
  onSelectNamespace?: (ns: string[]) => void;
  onDeleteRoleBindings: (items: V1RoleBinding[]) => Promise<void>;
  onCreate?: (manifest: V1RoleBinding) => Promise<V1RoleBinding | undefined>;
  onUpdate?: (manifest: V1RoleBinding) => Promise<V1RoleBinding | undefined>;
  contextName?: string;
}

export default function PaneRoleBindings({
  items,
  loading,
  error,
  namespaceList,
  selectedNamespaces,
  onSelectNamespace,
  onDeleteRoleBindings,
  onCreate,
  onUpdate,
  contextName,
}: PaneRoleBindingsProps) {
  const [sortBy, setSortBy] = useState<string>('metadata.name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const columns: ColumnDef<string>[] = [
    { key: 'metadata.name', label: 'Name' },
    { key: 'metadata.namespace', label: 'Namespace' },
    { key: 'subjects', label: 'Subjects' },
    { key: 'roleRef', label: 'Role Ref' },
    { key: 'metadata.creationTimestamp', label: 'Age' },
  ];

  const valueGetters = {
    subjects: (rb: V1RoleBinding) => String((rb.subjects || []).length),
    roleRef: (rb: V1RoleBinding) => rb.roleRef?.name || '-',
  } as const;

  const sortedItems = useMemo(() => {
    return sortItems(items, sortBy, sortOrder, valueGetters);
  }, [items, sortBy, sortOrder]);

  const handleDeleteSelected = useCallback(
    async (selected: V1RoleBinding[]) => {
      await onDeleteRoleBindings(selected);
    },
    [onDeleteRoleBindings]
  );

  const renderRow = (rb: V1RoleBinding) => (
    <>
      <Td className="max-w-truncate align-middle">
        <span className="block truncate" title={rb.metadata?.name ?? ''}>
          {rb.metadata?.name}
        </span>
      </Td>
      <Td>
        <BadgeNamespaces name={rb.metadata?.namespace ?? ''} />
      </Td>
      <Td>{(rb.subjects || []).length}</Td>
      <Td>{rb.roleRef?.name || '-'}</Td>
      <AgeCell timestamp={rb.metadata?.creationTimestamp ?? ''} />
    </>
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
      emptyText="No role bindings found"
      onDelete={handleDeleteSelected}
      onCreate={onCreate}
      onUpdate={onUpdate}
      sortBy={sortBy}
      sortOrder={sortOrder}
      setSortBy={setSortBy}
      setSortOrder={setSortOrder}
      contextName={contextName}
    />
  );
}