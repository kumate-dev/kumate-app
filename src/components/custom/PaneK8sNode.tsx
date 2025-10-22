import { useState } from 'react';
import { Td, Tr } from '@/components/ui/table';
import { useK8sResources } from '@/hooks/useK8sResources';
import { useFilteredItems } from '@/hooks/useFilteredItems';
import { listNodes, NodeItem, watchNodes } from '@/services/nodes';
import { Badge } from '@/components/ui/badge';
import AgeCell from '@/components/custom/AgeCell';
import { ColumnDef, TableHeader } from '@/components/custom/TableHeader';
import { K8sContext } from '@/services/contexts';
import { PaneK8sResource } from '@/components/custom/PaneK8sResource';

type SortKey = keyof NodeItem;

export default function PaneK8sNode({ context }: { context?: K8sContext | null }) {
  const { items, loading, error } = useK8sResources<NodeItem>(
    listNodes as (params: { name: string }) => Promise<NodeItem[]>,
    watchNodes,
    context
  );

  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const filtered = useFilteredItems(items, [], q, ['name'], sortBy, sortOrder);

  function conditionVariant(cond: string) {
    switch (cond) {
      case 'Ready':
        return 'success';
      case 'Unknown':
        return 'warning';
      default:
        return 'error';
    }
  }

  const columns: ColumnDef<keyof NodeItem | 'empty'>[] = [
    { label: 'Name', key: 'name' },
    { label: 'CPU', key: 'cpu' },
    { label: 'Memory', key: 'memory' },
    { label: 'Disk', key: 'disk' },
    { label: 'Taint', key: 'taints' },
    { label: 'Roles', key: 'roles' },
    { label: 'Version', key: 'version' },
    { label: 'Age', key: 'creation_timestamp' },
    { label: 'Conditions', key: 'condition' },
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
      renderRow={(f) => (
        <Tr key={f.name}>
          <Td className="max-w-truncate">
            <span className="block truncate" title={f.name}>
              {f.name}
            </span>
          </Td>
          <Td>{f.cpu || '—'}</Td>
          <Td>{f.memory || '—'}</Td>
          <Td>{f.disk || '—'}</Td>
          <Td>{f.taints || ''}</Td>
          <Td>{f.roles || ''}</Td>
          <Td>{f.version || ''}</Td>
          <AgeCell timestamp={f.creation_timestamp || ''} />
          <Td>
            <Badge variant={conditionVariant(f.condition || 'Unknown')}>
              {f.condition || 'Unknown'}
            </Badge>
          </Td>
          <Td>
            <button className="text-white/60 hover:text-white/80">⋮</button>
          </Td>
        </Tr>
      )}
    />
  );
}
