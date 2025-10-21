import { useState } from 'react';
import { Table, Thead, Tbody, Tr, Th, Td, Badge } from '../ui';
import { relativeAge } from '../../utils/time';
import { readyVariant, deploymentStatusVariant } from '../../utils/k8s';
import { useNamespaceStore, ALL_NAMESPACES } from '../../state/namespaceStore';
import { K8sContext } from '../../layouts/Sidebar';
import { useSelectedNamespaces } from '../../hooks/useSelectedNamespaces';
import { useK8sResources } from '../../hooks/useK8sResources';
import { listDeployments } from '../../services/k8s';
import { useFilteredItems } from '../../hooks/useFilteredItems';
import { PaneTaskbar } from '../shared/PaneTaskbar';

export interface Deployment {
  name: string;
  namespace: string;
  ready: string;
  status: string;
  creation_timestamp: string;
}

interface PaneDeploymentsProps {
  context?: K8sContext | null;
}

export default function PaneDeployments({ context }: PaneDeploymentsProps) {
  const selectedNs = useNamespaceStore((s) => s.selectedNs);
  const setSelectedNs = useNamespaceStore((s) => s.setSelectedNs);

  const namespaceList = useSelectedNamespaces(context);
  const nsParam = selectedNs === ALL_NAMESPACES ? undefined : selectedNs;
  const { items, loading, error } = useK8sResources<Deployment>(
    listDeployments as (params: { name: string; namespace?: string }) => Promise<Deployment[]>,
    context,
    nsParam
  );

  const [q, setQ] = useState('');
  const filtered = useFilteredItems(items, q);

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
              <Th>Ready</Th>
              <Th>Age</Th>
              <Th>Status</Th>
              <Th></Th>
            </Tr>
          </Thead>
          <Tbody>
            {loading && (
              <Tr>
                <Td colSpan={6} className="text-white/60">
                  Loading...
                </Td>
              </Tr>
            )}
            {!loading && filtered.length === 0 && (
              <Tr>
                <Td colSpan={6} className="text-white/60">
                  No deployments
                </Td>
              </Tr>
            )}
            {!loading &&
              filtered.map((d) => (
                <Tr key={d.name}>
                  <Td className="font-medium">{d.name}</Td>
                  <Td className="text-white/80">{d.namespace}</Td>
                  <Td>
                    <Badge variant={readyVariant(d.ready)}>{d.ready}</Badge>
                  </Td>
                  <Td className="text-white/80">{relativeAge(d.creation_timestamp)}</Td>
                  <Td>
                    <Badge variant={deploymentStatusVariant(d.status)}>
                      {d.status || 'Unknown'}
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
