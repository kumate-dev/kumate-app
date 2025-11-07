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
import { capitalizeFirstLetter } from '@/utils/string';
import { getPortForwardingStatus } from '../utils/portForwardingStatus';

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
  onStartItem?: (item: PortForwardItemDto) => Promise<void> | void;
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
  onStartItem,
}: PanePortForwardsProps) {
  const [pendingAction, setPendingAction] = useState<{ id: string; type: 'stop' | 'start' } | null>(
    null
  );
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
    return (
      <>
        <Td>
          <span className="block truncate" title={it.resourceName}>
            {it.resourceName}
          </span>
        </Td>
        <Td>
          <BadgeNamespaces name={it.namespace} />
        </Td>
        <Td>{capitalizeFirstLetter(it.resourceKind)}</Td>
        <Td>{it.remotePort}</Td>
        <Td>{it.localPort}</Td>
        <Td>{it.protocol}</Td>
        <Td>
          <BadgeStatus status={getPortForwardingStatus(it.status)} />
        </Td>
      </>
    );
  }, []);

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
      onDelete={onDelete}
      renderSidebar={(item, actions) => (
        <SidebarPortForwards
          item={item}
          setItem={actions.setItem}
          onStop={async () => {
            try {
              setPendingAction({ id: item.sessionId, type: 'stop' });
              await onStopItem?.(item);
            } finally {
              setPendingAction(null);
            }
          }}
          onStart={async () => {
            try {
              setPendingAction({ id: item.sessionId, type: 'start' });
              await onStartItem?.(item);
            } finally {
              setPendingAction(null);
            }
          }}
          onDelete={actions.onDelete}
          updating={pendingAction?.id === item.sessionId && pendingAction.type === 'stop'}
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
