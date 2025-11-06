import { useCallback, useMemo, useState } from 'react';
import type { V1ServiceAccount, V1Namespace } from '@kubernetes/client-node';
import { Td } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { PaneGeneric } from '../../generic/components/PaneGeneric';
import { SidebarServiceAccounts } from './SidebarServiceAccounts';
import { ColumnDef } from '@/components/common/TableHeader';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import { sortItems } from '@/utils/sort';

export interface PaneServiceAccountsProps {
  items: V1ServiceAccount[];
  loading: boolean;
  error: string;
  namespaceList?: V1Namespace[];
  selectedNamespaces?: string[];
  onSelectNamespace?: (ns: string[]) => void;
  onDeleteServiceAccounts: (items: V1ServiceAccount[]) => Promise<void>;
  onCreate?: (manifest: V1ServiceAccount) => Promise<V1ServiceAccount | undefined>;
  onUpdate?: (manifest: V1ServiceAccount) => Promise<V1ServiceAccount | undefined>;
  contextName?: string;
}

export default function PaneServiceAccounts({
  items,
  loading,
  error,
  namespaceList,
  selectedNamespaces,
  onSelectNamespace,
  onDeleteServiceAccounts,
  onCreate,
  onUpdate,
  contextName,
}: PaneServiceAccountsProps) {
  const [sortBy, setSortBy] = useState<string>('metadata.name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const columns: ColumnDef<string>[] = [
    { key: 'metadata.name', label: 'Name' },
    { key: 'metadata.namespace', label: 'Namespace' },
    { key: 'secrets', label: 'Secrets' },
    { key: 'metadata.creationTimestamp', label: 'Age' },
  ];

  const valueGetters = useMemo(
    () =>
      ({
        secrets: (sa: V1ServiceAccount) => String(sa.secrets?.length ?? 0),
      }) as const,
    []
  );

  const sortedItems = useMemo(() => {
    return sortItems(items, sortBy, sortOrder, valueGetters);
  }, [items, sortBy, sortOrder, valueGetters]);

  const handleDeleteSelected = useCallback(
    async (selected: V1ServiceAccount[]) => {
      await onDeleteServiceAccounts(selected);
    },
    [onDeleteServiceAccounts]
  );

  const renderRow = (sa: V1ServiceAccount) => (
    <>
      <Td className="max-w-truncate align-middle">
        <span className="block truncate" title={sa.metadata?.name ?? ''}>
          {sa.metadata?.name}
        </span>
      </Td>
      <Td>
        <BadgeNamespaces name={sa.metadata?.namespace ?? ''} />
      </Td>
      <Td>{sa.secrets?.length ?? 0}</Td>
      <AgeCell timestamp={sa.metadata?.creationTimestamp ?? ''} />
    </>
  );

  const renderSidebar = (
    item: V1ServiceAccount,
    actions: {
      setItem: (item: V1ServiceAccount | null) => void;
      onDelete?: (item: V1ServiceAccount) => void;
      onEdit?: (item: V1ServiceAccount) => void;
    }
  ) => (
    <SidebarServiceAccounts
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
      namespaceList={namespaceList}
      selectedNamespaces={selectedNamespaces}
      onSelectNamespace={onSelectNamespace}
      columns={columns}
      renderRow={renderRow}
      emptyText="No service accounts found"
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
