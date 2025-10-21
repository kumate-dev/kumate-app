import { useState } from 'react';
import { Table, Thead, Tbody, Tr, Th, Td, Badge } from '../ui';
import { getSelectedNamespace, readyVariant } from '../../utils/k8s';
import { useNamespaceStore } from '../../state/namespaceStore';
import { useSelectedNamespaces } from '../../hooks/useSelectedNamespaces';
import { K8sContext } from '../../layouts/Sidebar';
import { useK8sResources } from '../../hooks/useK8sResources';
import { listStatefulSets, watchStatefulSets } from '../../services/statefulsets';
import { useFilteredItems } from '../../hooks/useFilteredItems';
import { PaneTaskbar } from '../shared/PaneTaskbar';
import AgeCell from '../shared/AgeCell';

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
  const selectedNamespaces = useNamespaceStore((s) => s.selectedNamespaces);
  const setSelectedNamespaces = useNamespaceStore((s) => s.setSelectedNamespaces);

  const namespaceList = useSelectedNamespaces(context);
  const { items, loading, error } = useK8sResources<StatefulSet>(
    listStatefulSets as (params: { name: string; namespace?: string }) => Promise<StatefulSet[]>,
    watchStatefulSets,
    context,
    selectedNamespaces
  );

  const [q, setQ] = useState('');
  const filtered = useFilteredItems(items, selectedNamespaces, q, ['name', 'namespace']);

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
              filtered.map((f: StatefulSet) => (
                <Tr key={f.name}>
                  <Td className="font-medium">{f.name}</Td>
                  <Td className="text-white/80">{f.namespace}</Td>
                  <Td>
                    <Badge variant={readyVariant(f.ready)}>{f.ready}</Badge>
                  </Td>
                  <AgeCell timestamp={f.creation_timestamp || ''} />
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
