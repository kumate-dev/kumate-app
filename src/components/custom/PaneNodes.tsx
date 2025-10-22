import { useState } from 'react';
import { Table, Thead, Tbody, Tr, Th, Td, Badge } from '../ui';
import { useK8sResources } from '../../hooks/useK8sResources';
import { useFilteredItems } from '../../hooks/useFilteredItems';
import { PaneSearch } from '../shared/PaneSearch';
import { listNodes, NodeItem, watchNodes } from '../../services/nodes';
import { BadgeVariant } from '../../types/variant';
import AgeCell from '../shared/AgeCell';
import { K8sContext } from '../../services/contexts';

interface PaneNodesProps {
  context?: K8sContext | null;
}

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
  const filtered = useFilteredItems(nodes, [], q, ['name']);

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

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <PaneSearch query={q} onQueryChange={setQ} />
      </div>

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 p-2 text-sm text-red-200">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-white/10 bg-neutral-900/60">
        <Table>
          <Thead>
            <Tr>
              <Th>Name</Th>
              <Th>CPU</Th>
              <Th>Memory</Th>
              <Th>Disk</Th>
              <Th>Taint</Th>
              <Th>Roles</Th>
              <Th>Version</Th>
              <Th>Age</Th>
              <Th>Conditions</Th>
              <Th></Th>
            </Tr>
          </Thead>
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
              filtered.map((f: NodeItem) => (
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
  );
}
