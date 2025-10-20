import { useState, useMemo } from 'react';
import { Input, Table, Thead, Tbody, Tr, Th, Td, Badge } from '../ui';
import { relativeAge } from '../../utils/time';
import { podStatusVariant } from '../../utils/k8s';
import { useNamespaceStore, ALL } from '../../state/namespaceStore';
import { K8sContext } from '../../layouts/Sidebar';
import { useNamespaces } from '../../hooks/useNamespaces';
import { useK8sResources } from '../../hooks/useK8sResources';
import { listPods } from '../../services/k8s';

export interface Pod {
  name: string;
  namespace: string;
  containers?: number;
  container_states?: string[];
  cpu?: string;
  memory?: string;
  restart?: number;
  node?: string;
  qos?: string;
  creation_timestamp: string;
  phase?: string;
}

interface PanePodsProps {
  context?: K8sContext | null;
}

export default function PanePods({ context }: PanePodsProps) {
  const selectedNs = useNamespaceStore((s) => s.selectedNs);
  const setSelectedNs = useNamespaceStore((s) => s.setSelectedNs);

  const namespaceList = useNamespaces(context);
  const nsParam = selectedNs === ALL ? undefined : selectedNs;
  const { items, loading, error } = useK8sResources<Pod>(
    listPods as (params: { name: string; namespace?: string }) => Promise<Pod[]>,
    context,
    nsParam
  );

  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return items;
    return items.filter((p) => (p.name || '').toLowerCase().includes(term));
  }, [items, q]);

  const dotClass = (s: string | undefined) => {
    if (s === 'Running') return 'bg-green-500';
    if (s === 'Waiting') return 'bg-yellow-500';
    if (s === 'Failed') return 'bg-red-500';
    if (s === 'Terminated') return 'bg-gray-500';
    return 'bg-white/40';
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/60">Namespace</span>
          <select
            value={selectedNs}
            onChange={(e) => setSelectedNs(e.target.value)}
            className="rounded bg-white/10 px-2 py-1 text-xs text-white"
          >
            <option value={ALL}>{ALL}</option>
            {namespaceList.map((ns) => (
              <option key={ns.name} value={ns.name}>
                {ns.name}
              </option>
            ))}
          </select>
        </div>
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
              <Th>Namespace</Th>
              <Th>Containers</Th>
              <Th>CPU</Th>
              <Th>Memory</Th>
              <Th>Restart</Th>
              <Th>Node</Th>
              <Th>QoS</Th>
              <Th>Age</Th>
              <Th>Status</Th>
              <Th></Th>
            </Tr>
          </Thead>
          <Tbody>
            {loading && (
              <Tr>
                <Td colSpan={11} className="text-white/60">
                  Loading...
                </Td>
              </Tr>
            )}
            {!loading && filtered.length === 0 && (
              <Tr>
                <Td colSpan={11} className="text-white/60">
                  No pods
                </Td>
              </Tr>
            )}
            {!loading &&
              filtered.map((p) => (
                <Tr key={`${p.namespace}/${p.name}`}>
                  <Td className="font-medium">{p.name}</Td>
                  <Td className="text-white/80">{p.namespace}</Td>
                  <Td>
                    <div className="flex items-center gap-1">
                      {p.container_states?.length
                        ? p.container_states.map((st, idx) => (
                            <span
                              key={idx}
                              className={`inline-block h-2.5 w-2.5 rounded-full ${dotClass(st)}`}
                            ></span>
                          ))
                        : Array.from({ length: p.containers || 0 }).map((_, idx) => (
                            <span
                              key={idx}
                              className="inline-block h-2.5 w-2.5 rounded-full bg-white/30"
                            ></span>
                          ))}
                    </div>
                  </Td>
                  <Td className="text-white/80">{p.cpu || '-'}</Td>
                  <Td className="text-white/80">{p.memory || '-'}</Td>
                  <Td className="text-white/80">{p.restart ?? '-'}</Td>
                  <Td className="text-white/80">{p.node || '-'}</Td>
                  <Td className="text-white/80">{p.qos || '-'}</Td>
                  <Td className="text-white/80">{relativeAge(p.creation_timestamp)}</Td>
                  <Badge variant={podStatusVariant(p.phase ?? 'Unknown')}>
                    {p.phase ?? 'Unknown'}
                  </Badge>
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
