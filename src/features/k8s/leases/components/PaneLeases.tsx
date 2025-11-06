import { useMemo, useState, useCallback } from 'react';
import type { V1Lease } from '@kubernetes/client-node';
import { Td } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { PaneGeneric } from '../../generic/components/PaneGeneric';
import { ColumnDef } from '@/components/common/TableHeader';
import { sortItems } from '@/utils/sort';
import { SidebarLeases } from './SidebarLeases';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import { templateLease } from '../../templates/lease';

export interface PaneLeasesProps {
  items: V1Lease[];
  loading: boolean;
  error: string;
  namespaceList?: any[];
  selectedNamespaces?: string[];
  onSelectNamespace?: (ns: string[]) => void;
  onDelete: (items: V1Lease[]) => Promise<void>;
  onCreate?: (manifest: V1Lease) => Promise<V1Lease | undefined>;
  onUpdate?: (manifest: V1Lease) => Promise<V1Lease | undefined>;
  contextName?: string;
}

export default function PaneLeases({
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
}: PaneLeasesProps) {
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const handleDeleteSelected = useCallback(
    async (toDelete: V1Lease[]) => {
      if (!toDelete.length) return;
      await onDelete(toDelete);
    },
    [onDelete]
  );

  const columns: ColumnDef<string>[] = [
    { label: 'Name', key: 'name', sortable: true },
    { label: 'Namespace', key: 'namespace', sortable: true },
    { label: 'Holder', key: 'holder', sortable: true },
    { label: 'Duration (s)', key: 'duration', sortable: true },
    { label: 'Transitions', key: 'transitions', sortable: true },
    { label: 'Age', key: 'age', sortable: true },
  ];

  const sortedItems = useMemo(() => {
    const valueGetters = {
      name: (item: V1Lease) => item.metadata?.name || '',
      namespace: (item: V1Lease) => item.metadata?.namespace || '',
      holder: (item: V1Lease) => item.spec?.holderIdentity || '',
      duration: (item: V1Lease) => item.spec?.leaseDurationSeconds ?? 0,
      transitions: (item: V1Lease) => item.spec?.leaseTransitions ?? 0,
      age: (item: V1Lease) => new Date(item.metadata?.creationTimestamp || '').getTime(),
    };
    return sortItems(items, sortBy, sortOrder, valueGetters);
  }, [items, sortBy, sortOrder]);

  const renderRow = (lease: V1Lease) => (
    <>
      <Td className="max-w-truncate align-middle">
        <span className="block truncate" title={lease.metadata?.name ?? ''}>
          {lease.metadata?.name}
        </span>
      </Td>
      <Td>
        <BadgeNamespaces name={lease.metadata?.namespace ?? ''} />
      </Td>
      <Td>{lease.spec?.holderIdentity ?? '-'}</Td>
      <Td>{lease.spec?.leaseDurationSeconds ?? '-'}</Td>
      <Td>{lease.spec?.leaseTransitions ?? '-'}</Td>
      <AgeCell timestamp={lease.metadata?.creationTimestamp ?? ''} />
    </>
  );

  const renderSidebar = useCallback(
    (
      item: V1Lease,
      actions: {
        setItem: (item: V1Lease | null) => void;
        onDelete?: (item: V1Lease) => void;
        onEdit?: (item: V1Lease) => void;
      }
    ) => (
      <SidebarLeases
        item={item}
        setItem={actions.setItem}
        onDelete={actions.onDelete}
        onEdit={actions.onEdit}
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
      emptyText="No leases found"
      onDelete={handleDeleteSelected}
      renderSidebar={renderSidebar}
      yamlTemplate={templateLease}
      onCreate={onCreate}
      onUpdate={onUpdate}
      contextName={contextName}
      sortBy={sortBy}
      sortOrder={sortOrder}
      setSortBy={setSortBy}
      setSortOrder={setSortOrder}
    />
  );
}
