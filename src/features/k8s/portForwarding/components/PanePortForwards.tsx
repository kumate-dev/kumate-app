import { useCallback, useMemo, useState } from 'react';
import { ALL_NAMESPACES } from '@/constants/k8s';
import type { V1Namespace } from '@kubernetes/client-node';
import { PaneGeneric } from '@/features/k8s/generic/components/PaneGeneric';
import type { ColumnDef } from '@/components/common/TableHeader';
import { Td } from '@/components/ui/table';
import { BadgeNamespaces } from '@/features/k8s/generic/components/BadgeNamespaces';
import { BadgeStatus } from '@/features/k8s/generic/components/BadgeStatus';
import type { PortForwardItemDto } from '@/api/k8s/portForward';
import { SidebarPortForwards } from './SidebarPortForwards';

export interface PanePortForwardsProps {
  selectedNamespaces?: string[];
  onSelectNamespace?: (ns: string[]) => void;
  namespaceList?: V1Namespace[];
  items: PortForwardItemDto[];
  loading: boolean;
  error?: string | null;
  onDelete: (items: PortForwardItemDto[]) => Promise<void>;
  contextName?: string;
  onStopItem?: (item: PortForwardItemDto) => Promise<void> | void;
}

export function PanePortForwards({
  selectedNamespaces = [],
  onSelectNamespace,
  namespaceList = [],
  items,
  loading,
  error,
  onDelete,
  contextName,
  onStopItem,
}: PanePortForwardsProps) {
  const [sortBy, setSortBy] = useState<string>('Name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const columns: ColumnDef<string>[] = useMemo(
    () => [
      { key: 'Name', label: 'Name', sortable: true },
      { key: 'Namespace', label: 'Namespace', sortable: true },
      { key: 'Kind', label: 'Kind', sortable: true },
      { key: 'Pod Port', label: 'Pod Port', sortable: true },
      { key: 'Local Port', label: 'Local Port', sortable: true },
      { key: 'Protocol', label: 'Protocol', sortable: true },
      { key: 'Status', label: 'Status', sortable: true },
    ],
    []
  );

  const filteredSortedItems = useMemo(() => {
    const namespaceSet = new Set(selectedNamespaces);
    const filtered = selectedNamespaces.length
      ? items.filter((it) =>
          namespaceSet.has(ALL_NAMESPACES) ? true : namespaceSet.has(it.namespace || '')
        )
      : items;

    const copy = [...filtered];
    copy.sort((a, b) => {
      const getters: Record<string, (x: PortForwardItemDto) => string | number> = {
        Name: (x) => x.resourceName || '-',
        Namespace: (x) => x.namespace || '-',
        Kind: (x) => x.resourceKind,
        'Pod Port': (x) => x.remotePort || '-',
        'Local Port': (x) => x.localPort || '-',
        Protocol: (x) => x.protocol || '-',
        Status: (x) => x.status || '-',
      };
      const av = getters[sortBy]?.(a) ?? '';
      const bv = getters[sortBy]?.(b) ?? '';
      const result = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortOrder === 'asc' ? result : -result;
    });
    return copy;
  }, [items, selectedNamespaces, sortBy, sortOrder]);

  const renderRow = useCallback((it: PortForwardItemDto) => {
    const statusVariant = it.status === 'Running' ? 'success' : 'default';
    return (
      <>
        <Td className="py-2">
          <span className="block truncate" title={it.resourceName}>{it.resourceName}</span>
        </Td>
        <Td className="py-2">
          <BadgeNamespaces name={it.namespace} />
        </Td>
        <Td className="py-2">{it.resourceKind}</Td>
        <Td className="py-2">{it.remotePort}</Td>
        <Td className="py-2">{it.localPort}</Td>
        <Td className="py-2">{it.protocol}</Td>
        <Td className="py-2">
          <BadgeStatus status={{ status: it.status, variant: statusVariant }} />
        </Td>
      </>
    );
  }, []);

  const handleDeleteSelected = useCallback(
    async (toDelete: PortForwardItemDto[]) => {
      await onDelete(toDelete);
    },
    [onDelete]
  );

  return (
    <PaneGeneric<PortForwardItemDto>
      items={filteredSortedItems}
      loading={loading}
      error={error ?? ''}
      namespaceList={namespaceList}
      selectedNamespaces={selectedNamespaces}
      onSelectNamespace={onSelectNamespace}
      columns={columns}
      renderRow={renderRow}
      onDelete={handleDeleteSelected}
      renderSidebar={(item, actions) => (
        <SidebarPortForwards
          item={item}
          setItem={actions.setItem}
          onStop={() => {
            onStopItem?.(item);
          }}
          onDelete={actions.onDelete}
          onEdit={() => {
            /* edit opens modal inside sidebar */
          }}
        />
      )}
      sortBy={sortBy}
      sortOrder={sortOrder}
      setSortBy={setSortBy}
      setSortOrder={setSortOrder}
      showNamespace={true}
      contextName={contextName}
    />
  );
}