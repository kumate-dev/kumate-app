import { useState } from 'react';
import { Table, Thead, Tbody, Tr, Th, Td, Badge } from '../ui';
import { relativeAge } from '../../utils/time';
import { conditionVariant } from '../../utils/k8s';
import { K8sContext } from '../../layouts/Sidebar';
import { useK8sResources } from '../../hooks/useK8sResources';
import { listNodes } from '../../services/k8s';
import { useFilteredItems } from '../../hooks/useFilteredItems';
import { PaneSearch } from '../shared/PaneSearch';

export interface Node {
  name: string;
  cpu?: string;
  memory?: string;
  disk?: string;
  taints?: string;
  roles?: string;
  version?: string;
  age?: string;
  condition?: string;
}

interface PaneNodesProps {
  context?: K8sContext | null;
}

export default function PaneNodes({ context }: PaneNodesProps) {
  const {
    items: nodes,
    loading,
    error,
  } = useK8sResources<Node>(
    listNodes as (params: { name: string }) => Promise<Node[]>,
    context,
    undefined
  );

  const [q, setQ] = useState('');
  const filtered = useFilteredItems(nodes, q);

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
              filtered.map((i: Node) => (
                <Tr key={i.name}>
                  <Td className="font-medium">{i.name}</Td>
                  <Td>{i.cpu || '—'}</Td>
                  <Td>{i.memory || '—'}</Td>
                  <Td>{i.disk || '—'}</Td>
                  <Td className="text-white/70">{i.taints || ''}</Td>
                  <Td className="text-white/80">{i.roles || ''}</Td>
                  <Td className="text-white/80">{i.version || ''}</Td>
                  <Td className="text-white/80">{relativeAge(i.age)}</Td>
                  <Td>
                    <Badge variant={conditionVariant(i.condition || 'Unknown')}>
                      {i.condition || 'Unknown'}
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
