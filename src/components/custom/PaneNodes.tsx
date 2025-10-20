import { useState, useMemo } from 'react';
import { Input, Table, Thead, Tbody, Tr, Th, Td, Badge } from '../ui';
import { relativeAge } from '../../utils/time';
import { conditionVariant } from '../../utils/k8s';
import { K8sContext } from '../../layouts/Sidebar';
import { useK8sResources } from '../../hooks/useK8sResources';
import { listNodes } from '../../services/k8s';

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

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return nodes;
    return nodes.filter((n) => (n.name || '').toLowerCase().includes(term));
  }, [nodes, q]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Input
          placeholder="Search..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
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
              filtered.map((n) => (
                <Tr key={n.name}>
                  <Td className="font-medium">{n.name}</Td>
                  <Td>{n.cpu || '—'}</Td>
                  <Td>{n.memory || '—'}</Td>
                  <Td>{n.disk || '—'}</Td>
                  <Td className="text-white/70">{n.taints || ''}</Td>
                  <Td className="text-white/80">{n.roles || ''}</Td>
                  <Td className="text-white/80">{n.version || ''}</Td>
                  <Td className="text-white/80">{relativeAge(n.age)}</Td>
                  <Td>
                    <Badge variant={conditionVariant(n.condition || 'Unknown')}>
                      {n.condition || 'Unknown'}
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
