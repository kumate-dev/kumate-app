import { useMemo, useState, useCallback } from 'react';
import { V1Node } from '@kubernetes/client-node';
import { Td } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { ColumnDef } from '../../../../components/common/TableHeader';
import { PaneGeneric } from '../../generic/components/PaneGeneric';
import { SidebarNodes } from './SidebarNodes';
import { BadgeStatus } from '../../generic/components/BadgeStatus';
import { getNodeStatus } from '../utils/nodeStatus';
import { sortItems } from '@/utils/sort';

export interface PaneNodesProps {
  items: V1Node[];
  loading: boolean;
  error: string;
  onDeleteNodes?: (nodes: V1Node[]) => Promise<void>;
  deleting?: boolean;
}

export default function PaneNodes({
  items,
  loading,
  error,
  onDeleteNodes,
  deleting = false,
}: PaneNodesProps) {
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const getNodeRoles = (node: V1Node): string => {
    return (
      Object.keys(node.metadata?.labels || {})
        .filter((k) => k.startsWith('node-role.kubernetes.io/'))
        .map((k) => k.replace('node-role.kubernetes.io/', ''))
        .join(', ') || '—'
    );
  };

  const columns: ColumnDef<string>[] = [
    { label: 'Name', key: 'name', sortable: true },
    { label: 'Roles', key: 'roles', sortable: true },
    { label: 'Version', key: 'version', sortable: true },
    { label: 'Age', key: 'age', sortable: true },
    { label: 'Condition', key: 'condition', sortable: true },
  ];

  const sortedItems = useMemo(() => {
    const valueGetters = {
      name: (item: V1Node) => item.metadata?.name || '',
      roles: (item: V1Node) => getNodeRoles(item),
      version: (item: V1Node) => item.status?.nodeInfo?.kubeletVersion || '',
      age: (item: V1Node) => new Date(item.metadata?.creationTimestamp || '').getTime(),
      condition: (item: V1Node) => getNodeStatus(item),
    };
    return sortItems(items, sortBy, sortOrder, valueGetters);
  }, [items, sortBy, sortOrder]);

  const renderRow = (node: V1Node) => {
    const roles = getNodeRoles(node);
    const version = node.status?.nodeInfo?.kubeletVersion || '—';

    return (
      <>
        <Td className="max-w-truncate" title={node.metadata?.name}>
          {node.metadata?.name}
        </Td>
        <Td>{roles}</Td>
        <Td>{version}</Td>
        <AgeCell timestamp={node.metadata?.creationTimestamp || ''} />
        <Td>
          <BadgeStatus status={getNodeStatus(node)} />
        </Td>
      </>
    );
  };

  const renderSidebar = (
    item: V1Node,
    actions: {
      setItem: (item: V1Node | null) => void;
      onDelete?: (item: V1Node) => void;
      onEdit?: (item: V1Node) => void;
    }
  ) => (
    <SidebarNodes
      item={item}
      setItem={actions.setItem}
      onDelete={actions.onDelete}
      onEdit={actions.onEdit}
      deleting={deleting}
    />
  );

  const handleDeleteSelected = useCallback(
    async (toDelete: V1Node[]) => {
      if (!toDelete.length || !onDeleteNodes) return;
      await onDeleteNodes(toDelete);
    },
    [onDeleteNodes]
  );

  return (
    <PaneGeneric
      items={sortedItems}
      loading={loading}
      error={error}
      showNamespace={false}
      colSpan={columns.length}
      columns={columns}
      sortBy={sortBy}
      sortOrder={sortOrder}
      setSortBy={setSortBy}
      setSortOrder={setSortOrder}
      onDelete={handleDeleteSelected}
      renderRow={renderRow}
      renderSidebar={renderSidebar}
      deleting={deleting}
    />
  );
}
