import { useState } from 'react';
import { Input, Table, Thead, Tbody, Tr, Th, Td, Badge } from '../ui';
import { relativeAge } from '../../utils/time';
import { readyVariant } from '../../utils/k8s';
import { useNamespaceStore, ALL_NAMESPACES } from '../../state/namespaceStore';
import { useSelectedNamespaces } from '../../hooks/useSelectedNamespaces';
import { K8sContext } from '../../layouts/Sidebar';
import { useK8sResources } from '../../hooks/useK8sResources';
import { listStatefulSets } from '../../services/k8s';
import { useFilteredItems } from '../../hooks/useFilteredItems';

export interface StatefulSet {
  name: string;
  namespace: string;
  ready: string;
  creation_timestamp: string;
}

interface PaneStatefulSetsProps {
  context?: K8sContext | null;
}

export default function PaneStatefulSets({ context }: PaneStatefulSetsProps) {
  const selectedNs = useNamespaceStore((s) => s.selectedNs);
  const setSelectedNs = useNamespaceStore((s) => s.setSelectedNs);

  const namespaceList = useSelectedNamespaces(context);
  const nsParam = selectedNs === ALL_NAMESPACES ? undefined : selectedNs;
  const { items, loading, error } = useK8sResources<StatefulSet>(
    listStatefulSets as (params: { name: string; namespace?: string }) => Promise<StatefulSet[]>,
    context,
    nsParam
  );

  const [q, setQ] = useState('');
  const filtered = useFilteredItems(items, q);

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
            <option value={ALL_NAMESPACES}>{ALL_NAMESPACES}</option>
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
              <Th>Ready</Th>
              <Th>Age</Th>
              <Th></Th>
            </Tr>
          </Thead>
          <Tbody>
            {loading && (
              <Tr>
                <Td colSpan={5} className="text-white/60">
                  Loading...
                </Td>
              </Tr>
            )}
            {!loading && filtered.length === 0 && (
              <Tr>
                <Td colSpan={5} className="text-white/60">
                  No statefulsets
                </Td>
              </Tr>
            )}
            {!loading &&
              filtered.map((d: StatefulSet) => (
                <Tr key={d.name}>
                  <Td className="font-medium">{d.name}</Td>
                  <Td className="text-white/80">{d.namespace}</Td>
                  <Td>
                    <Badge variant={readyVariant(d.ready)}>{d.ready}</Badge>
                  </Td>
                  <Td className="text-white/80">{relativeAge(d.creation_timestamp)}</Td>
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
