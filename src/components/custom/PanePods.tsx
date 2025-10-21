import { useState } from 'react';
import { Table, Thead, Tbody, Tr, Th, Td, Badge } from '../ui';
import { relativeAge } from '../../utils/time';
import { getSelectedNamespace, podStatusVariant } from '../../utils/k8s';
import { useNamespaceStore } from '../../state/namespaceStore';
import { K8sContext } from '../../layouts/Sidebar';
import { useSelectedNamespaces } from '../../hooks/useSelectedNamespaces';
import { useK8sResources } from '../../hooks/useK8sResources';
import { listPods } from '../../services/pods';
import { useFilteredItems } from '../../hooks/useFilteredItems';
import { PaneTaskbar } from '../shared/PaneTaskbar';
import AgeCell from '../shared/AgeCell';

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

  const namespaceList = useSelectedNamespaces(context);
  const { items, loading, error } = useK8sResources<Pod>(
    listPods as (params: { name: string; namespace?: string }) => Promise<Pod[]>,
    context,
    getSelectedNamespace(selectedNs)
  );

  const [q, setQ] = useState('');
  const filtered = useFilteredItems(items, q);

  const dotClass = (s: string | undefined) => {
    if (s === 'Running') return 'bg-green-500';
    if (s === 'Waiting') return 'bg-yellow-500';
    if (s === 'Failed') return 'bg-red-500';
    if (s === 'Terminated') return 'bg-gray-500';
    return 'bg-white/40';
  };

  return (
    <div className="space-y-3">
      <PaneTaskbar
        namespaceList={namespaceList}
        selectedNs={selectedNs}
        onSelectNamespace={setSelectedNs}
        query={q}
        onQueryChange={setQ}
      />

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
                  <AgeCell timestamp={p.creation_timestamp || ''} />
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
