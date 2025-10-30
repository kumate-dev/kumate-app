import { useState } from 'react';
import { V1Node } from '@kubernetes/client-node';
import { Td, Tr } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import AgeCell from '@/components/common/AgeCell';
import { ColumnDef, TableHeader } from '../../../../components/common/TableHeader';
import { PaneGeneric } from '../../generic/components/PaneGeneric';
import { BadgeVariant } from '@/types/variant';
import { BadgeStatus } from '../../generic/components/BadgeStatus';
import { getNodeStatus } from '../utils/nodeStatus';

export interface PaneNodesProps {
  items: V1Node[];
  loading: boolean;
  error: string;
}

export default function PaneNodes({ items, loading, error }: PaneNodesProps) {
  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState<keyof V1Node>('metadata');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedItems, setSelectedItems] = useState<V1Node[]>([]);

  const getNodeRoles = (node: V1Node): string => {
    return (
      Object.keys(node.metadata?.labels || {})
        .filter((k) => k.startsWith('node-role.kubernetes.io/'))
        .map((k) => k.replace('node-role.kubernetes.io/', ''))
        .join(', ') || '—'
    );
  };

  const toggleItem = (node: V1Node) => {
    setSelectedItems((prev) =>
      prev.includes(node) ? prev.filter((n) => n !== node) : [...prev, node]
    );
  };

  const toggleAll = (checked: boolean) => {
    setSelectedItems(checked ? [...items] : []);
  };

  const columns: ColumnDef<keyof V1Node | ''>[] = [
    { label: 'Name', key: 'metadata' },
    { label: 'Roles', key: 'metadata' },
    { label: 'Version', key: 'status' },
    { label: 'Age', key: 'metadata' },
    { label: 'Condition', key: 'status' },
  ];

  const tableHeader = (
    <TableHeader
      columns={columns}
      sortBy={sortBy}
      sortOrder={sortOrder}
      setSortBy={setSortBy}
      setSortOrder={setSortOrder}
      onToggleAll={toggleAll}
      selectedItems={selectedItems}
      totalItems={items}
    />
  );

  const renderRow = (node: V1Node) => {
    const roles = getNodeRoles(node);
    const version = node.status?.nodeInfo?.kubeletVersion || '—';

    return (
      <Tr key={node.metadata?.name}>
        <Td className="max-w-truncate" title={node.metadata?.name}>
          {node.metadata?.name}
        </Td>
        <Td>{roles}</Td>
        <Td>{version}</Td>
        <AgeCell timestamp={node.metadata?.creationTimestamp || ''} />
        <Td>
          <BadgeStatus status={getNodeStatus(node)} />
        </Td>
      </Tr>
    );
  };

  return (
    <PaneGeneric
      items={items}
      loading={loading}
      error={error}
      query={q}
      onQueryChange={setQ}
      showNamespace={false}
      selectedItems={selectedItems}
      onToggleItem={toggleItem}
      colSpan={columns.length}
      tableHeader={tableHeader}
      renderRow={renderRow}
    />
  );
}
