import { useMemo, useState } from 'react';
import type { V1RoleBinding, V1Namespace } from '@kubernetes/client-node';
import { Td } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { PaneGeneric } from '../../generic/components/PaneGeneric';
import { SidebarRoleBindings } from './SidebarRoleBindings';
import { ColumnDef } from '@/components/common/TableHeader';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import { templateRoleBinding } from '../../templates/roleBinding';
import { useOptimisticSortedItems } from '@/hooks/useOptimisticSortedItems';

export interface PaneRoleBindingsProps {
  items: V1RoleBinding[];
  loading: boolean;
  error: string;
  namespaceList?: V1Namespace[];
  selectedNamespaces?: string[];
  onSelectNamespace?: (ns: string[]) => void;
  onDelete: (items: V1RoleBinding[]) => Promise<void>;
  onCreate?: (manifest: V1RoleBinding) => Promise<V1RoleBinding | undefined>;
  onUpdate?: (manifest: V1RoleBinding) => Promise<V1RoleBinding | undefined>;
  contextName?: string;
  creating?: boolean;
  updating?: boolean;
  deleting?: boolean;
}

export default function PaneRoleBindings({
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
  creating,
  updating,
  deleting,
}: PaneRoleBindingsProps) {
  const [sortBy, setSortBy] = useState<string>('metadata.name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const valueGetters = useMemo(
    () =>
      ({
        subjects: (rb: V1RoleBinding) => String((rb.subjects || []).length),
        roleRef: (rb: V1RoleBinding) => rb.roleRef?.name || '-',
      }) as const,
    []
  );

  const { sortedItems, onAfterCreate } = useOptimisticSortedItems<V1RoleBinding>({
    items,
    sortBy,
    sortOrder,
    valueGetters,
    selectedNamespaces,
    isNamespaced: true,
  });

  const columns: ColumnDef<string>[] = [
    { key: 'metadata.name', label: 'Name' },
    { key: 'metadata.namespace', label: 'Namespace' },
    { key: 'subjects', label: 'Subjects' },
    { key: 'roleRef', label: 'Role Ref' },
    { key: 'metadata.creationTimestamp', label: 'Age' },
  ];

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

  const renderSidebar = (
    item: V1RoleBinding,
    actions: {
      setItem: (item: V1RoleBinding | null) => void;
      onDelete?: (item: V1RoleBinding) => void;
      onEdit?: (item: V1RoleBinding) => void;
    }
  ) => (
    <SidebarRoleBindings
      item={item}
      setItem={actions.setItem}
      onDelete={actions.onDelete}
      onEdit={actions.onEdit}
      contextName={contextName}
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
      emptyText="No role bindings found"
      onDelete={onDelete}
      yamlTemplate={templateRoleBinding}
      onCreate={onCreate}
      onUpdate={onUpdate}
      onAfterCreate={onAfterCreate}
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
