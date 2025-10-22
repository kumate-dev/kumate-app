import { useState } from 'react';
import { Table, Tbody, Td, Tr } from '@/components/ui/table';
import { useK8sResources } from '@/hooks/useK8sResources';
import { useFilteredItems } from '@/hooks/useFilteredItems';
import AgeCell from '@/components/custom/AgeCell';
import { PaneSearch } from '@/components/custom/PaneSearch';
import { listNodes, NodeItem, watchNodes } from '@/services/nodes';
import { BadgeVariant } from '@/types/variant';
import { ColumnDef, TableHeader } from '@/components/custom/TableHeader';
import { K8sContext } from '@/services/contexts';
import { ErrorMessage } from '@/components/custom/ErrorMessage';
import { Badge } from '@/components/ui/badge';
import { PaneTaskbar } from './PaneTaskbar';

interface PaneNodesProps {
  context?: K8sContext | null;
}

type SortKey = keyof NodeItem;

export default function PaneNodes({ context }: PaneNodesProps) {
  const {
    items: nodes,
    loading,
    error,
  } = useK8sResources<NodeItem>(
    listNodes as (params: { name: string }) => Promise<NodeItem[]>,
    watchNodes,
    context
  );

  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const filtered = useFilteredItems(nodes, [], q, ['name'], sortBy, sortOrder);

  function conditionVariant(cond: string): BadgeVariant {
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

  return (
    <div className="flex h-full flex-col space-y-3">
      <PaneTaskbar query={q} onQueryChange={setQ} showNamespace={false} />
      <ErrorMessage message={error} />

      <div className="flex-1 overflow-hidden rounded-xl border border-white/10 bg-neutral-900/60">
        <div className="h-full overflow-auto">
          <div className="min-w-max">
            <Table>
              <TableHeader
                columns={columns}
                sortBy={sortBy}
                sortOrder={sortOrder}
                setSortBy={setSortBy}
                setSortOrder={setSortOrder}
              />
              <Tbody>
                {loading && (
                  <Tr>
                    <Td colSpan={10} className="text-white/60">
                      Loading...
                    </Td>
                  </Tr>
                )}
                {!loading && filtered.length === 0 && (
                  <Tr>
                    <Td colSpan={10} className="text-white/60">
                      No nodes
                    </Td>
                  </Tr>
                )}
                {!loading &&
                  filtered.map((f) => (
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
                  ))}
              </Tbody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
}
