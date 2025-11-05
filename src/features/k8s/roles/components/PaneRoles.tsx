import { useCallback, useMemo, useState } from 'react';
import type { V1Role, V1Namespace } from '@kubernetes/client-node';
import { Td } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { PaneGeneric } from '../../generic/components/PaneGeneric';
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
  onDeleteRoles: (items: V1Role[]) => Promise<void>;
  onCreate?: (manifest: V1Role) => Promise<V1Role | undefined>;
  onUpdate?: (manifest: V1Role) => Promise<V1Role | undefined>;
  contextName?: string;
}

export default function PaneRoles({
  items,
  loading,
  error,
  namespaceList,
  selectedNamespaces,
  onSelectNamespace,
  onDeleteRoles,
  onCreate,
  onUpdate,
  contextName,
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
      await onDeleteRoles(selected);
    },
    [onDeleteRoles]
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
      sortBy={sortBy}
      sortOrder={sortOrder}
      setSortBy={setSortBy}
      setSortOrder={setSortOrder}
      contextName={contextName}
    />
  );
}
