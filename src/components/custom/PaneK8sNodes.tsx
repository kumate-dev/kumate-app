import { useState } from 'react';
import { Td, Tr } from '@/components/ui/table';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import { useFilteredItems } from '@/hooks/useFilteredItems';
import { listNodes, watchNodes } from '@/api/k8s/nodes';
import { V1Node } from '@kubernetes/client-node';
import { Badge } from '@/components/ui/badge';
import AgeCell from '@/components/custom/AgeCell';
import { ColumnDef, TableHeader } from './TableHeader';
import { PaneK8sResource, PaneK8sResourceContextProps } from './PaneK8sResource';

export default function PaneK8sNodes({ context }: PaneK8sResourceContextProps) {
  const { items, loading, error } = useListK8sResources<V1Node>(listNodes, watchNodes, context);

  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState<keyof V1Node>('metadata');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const filtered = useFilteredItems(
    items,
    [],
    q,
    ['metadata.name', 'metadata.labels["kubernetes.io/role"]', 'status.nodeInfo.kubeletVersion'],
    sortBy,
    sortOrder
  );

  const extractCondition = (node: V1Node): string => {
    const conditions = node.status?.conditions;
    if (!conditions) return 'Unknown';

    const readyCond = conditions.find((c) => c.type === 'Ready');
    if (!readyCond) return 'Unknown';

    switch (readyCond.status) {
      case 'True':
        return 'Ready';
      case 'Unknown':
        return 'Unknown';
      default:
        return 'NotReady';
    }
  };

  const conditionVariant = (status: string) => {
    switch (status) {
      case 'Ready':
        return 'success';
      case 'Unknown':
        return 'warning';
      default:
        return 'error';
    }
  };

  const columns: ColumnDef<keyof V1Node | ''>[] = [
    { label: 'Name', key: 'metadata' },
    { label: 'Roles', key: 'metadata' },
    { label: 'Version', key: 'status' },
    { label: 'Age', key: 'metadata' },
    { label: 'Condition', key: 'status' },
    { label: '', key: '', sortable: false },
  ];

  const tableHeader = (
    <TableHeader
      columns={columns}
      sortBy={sortBy}
      sortOrder={sortOrder}
      setSortBy={setSortBy}
      setSortOrder={setSortOrder}
    />
  );

  const renderRow = (node: V1Node) => {
    const condition = extractCondition(node);
    const roles =
      Object.keys(node.metadata?.labels || {})
        .filter((k) => k.startsWith('node-role.kubernetes.io/'))
        .map((k) => k.replace('node-role.kubernetes.io/', ''))
        .join(', ') || '—';

    const version = node.status?.nodeInfo?.kubeletVersion || '—';
    const age = node.metadata?.creationTimestamp || '';

    return (
      <Tr key={node.metadata?.name}>
        <Td className="max-w-truncate" title={node.metadata?.name}>
          {node.metadata?.name}
        </Td>
        <Td>{roles}</Td>
        <Td>{version}</Td>
        <AgeCell timestamp={age} />
        <Td>
          <Badge variant={conditionVariant(condition)}>{condition}</Badge>
        </Td>
        <Td>
          <button className="text-white/60 hover:text-white/80">⋮</button>
        </Td>
      </Tr>
    );
  };

  return (
    <PaneK8sResource
      items={filtered}
      loading={loading}
      error={error ?? ''}
      query={q}
      onQueryChange={setQ}
      showNamespace={false}
      colSpan={columns.length}
      tableHeader={tableHeader}
      renderRow={renderRow}
    />
  );
}
