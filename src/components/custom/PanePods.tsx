import { useState } from 'react';
import { Table, Thead, Tbody, Tr, Th, Td, Badge } from '../ui';
import { useNamespaceStore } from '../../state/namespaceStore';
import { K8sContext } from '../../layouts/Sidebar';
import { useSelectedNamespaces } from '../../hooks/useSelectedNamespaces';
import { useK8sResources } from '../../hooks/useK8sResources';
import { listPods, watchPods } from '../../services/pods';
import { useFilteredItems } from '../../hooks/useFilteredItems';
import { PaneTaskbar } from '../shared/PaneTaskbar';
import AgeCell from '../shared/AgeCell';
import { AlertTriangle } from 'lucide-react';
import { BadgeVariant } from '../../types/variant';

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
  creation_timestamp?: string;
  phase?: string;
}

interface PanePodsProps {
  context?: K8sContext | null;
}

export default function PanePods({ context }: PanePodsProps) {
  const selectedNamespaces = useNamespaceStore((s) => s.selectedNamespaces);
  const setSelectedNamespaces = useNamespaceStore((s) => s.setSelectedNamespaces);

  const namespaceList = useSelectedNamespaces(context);

  const { items, loading, error } = useK8sResources<Pod>(
    listPods as (params: { name: string; namespaces?: string[] }) => Promise<Pod[]>,
    watchPods,
    context,
    selectedNamespaces
  );

  const [q, setQ] = useState('');

  const filtered = useFilteredItems(items, selectedNamespaces, q, ['name', 'namespace']);

  const dotClass = (s: string | undefined) => {
    switch (s) {
      case 'Running':
        return 'bg-green-500';
      case 'Failed':
        return 'bg-red-500';
      case 'Terminated':
      case 'Completed':
        return 'bg-gray-500';
      default:
        return 'bg-yellow-500';
    }
  };

  function podStatusVariant(s: string): BadgeVariant {
    switch (s) {
      case 'Pending':
      case 'ContainerCreating':
        return 'warning';

      case 'Running':
      case 'Succeeded':
        return 'success';

      case 'Failed':
      case 'CrashLoopBackOff':
      case 'ImagePullBackOff':
      case 'ErrImagePull':
      case 'OOMKilled':
      case 'Terminating':
        return 'error';

      default:
        return 'default';
    }
  }

  function hasPodWarning(p: Pod): boolean {
    const phase = p.phase ?? 'Unknown';
    if (['Failed', 'Unknown'].includes(phase)) return true;

    const badStates = [
      'CrashLoopBackOff',
      'ErrImagePull',
      'ImagePullBackOff',
      'CreateContainerConfigError',
      'CreateContainerError',
      'InvalidImageName',
      'RunContainerError',
      'OOMKilled',
      'Error',
      'ContainerCannotRun',
      'DeadlineExceeded',
    ];

    if (p.container_states?.some((st) => badStates.includes(st))) return true;

    return false;
  }

  return (
    <div className="space-y-3">
      <PaneTaskbar
        namespaceList={namespaceList}
        selectedNamespaces={selectedNamespaces}
        onSelectNamespace={setSelectedNamespaces}
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
              <Th></Th>
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
              filtered.map((f) => (
                <Tr key={`${f.namespace}/${f.name}`}>
                  <Td className="font-medium">{f.name}</Td>
                  <Td className="text-center">
                    {hasPodWarning(f) && (
                      <AlertTriangle className="inline-block h-4 w-4 text-yellow-400" />
                    )}
                  </Td>
                  <Td className="text-white/80">{f.namespace}</Td>
                  <Td>
                    <div className="flex items-center gap-1">
                      {f.container_states?.length
                        ? f.container_states.map((st, idx) => (
                            <span
                              key={idx}
                              className={`inline-block h-2.5 w-2.5 rounded-full ${dotClass(st)}`}
                            ></span>
                          ))
                        : Array.from({ length: f.containers || 0 }).map((_, idx) => (
                            <span
                              key={idx}
                              className="inline-block h-2.5 w-2.5 rounded-full bg-white/30"
                            ></span>
                          ))}
                    </div>
                  </Td>
                  <Td className="text-white/80">{f.cpu || '-'}</Td>
                  <Td className="text-white/80">{f.memory || '-'}</Td>
                  <Td className="text-white/80">{f.restart ?? '-'}</Td>
                  <Td className="text-white/80">{f.node || '-'}</Td>
                  <Td className="text-white/80">{f.qos || '-'}</Td>
                  <AgeCell timestamp={f.creation_timestamp || ''} />
                  <Td>
                    <Badge variant={podStatusVariant(f.phase ?? '')}>{f.phase ?? ''}</Badge>
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
