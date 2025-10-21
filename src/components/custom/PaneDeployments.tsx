import { useState } from 'react';
import { Table, Thead, Tbody, Tr, Th, Td, Badge } from '../ui';
import { readyVariant, deploymentStatusVariant, getSelectedNamespace } from '../../utils/k8s';
import { useNamespaceStore } from '../../state/namespaceStore';
import { K8sContext } from '../../layouts/Sidebar';
import { useSelectedNamespaces } from '../../hooks/useSelectedNamespaces';
import { useK8sResources } from '../../hooks/useK8sResources';
import { DeploymentItem, listDeployments, watchDeployments } from '../../services/deployments';
import { useFilteredItems } from '../../hooks/useFilteredItems';
import { PaneTaskbar } from '../shared/PaneTaskbar';
import AgeCell from '../shared/AgeCell';

interface PaneDeploymentsProps {
  context?: K8sContext | null;
}

export default function PaneDeployments({ context }: PaneDeploymentsProps) {
  const selectedNs = useNamespaceStore((s) => s.selectedNs);
  const setSelectedNs = useNamespaceStore((s) => s.setSelectedNs);

  const namespaceList = useSelectedNamespaces(context);

  const { items, loading, error } = useK8sResources<DeploymentItem>(
    listDeployments,
    context,
    getSelectedNamespace(selectedNs),
    watchDeployments
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
              filtered.map((i) => (
                <Tr key={`${i.namespace}-${i.name}`}>
                  <Td className="font-medium">{i.name}</Td>
                  <Td className="text-white/80">{i.namespace}</Td>
                  <Td>
                    <Badge variant={readyVariant(i.ready)}>{i.ready}</Badge>
                  </Td>
                  <AgeCell timestamp={i.creation_timestamp || ''} />
                  <Td>
                    <Badge variant={deploymentStatusVariant(i.status || 'Unknown')}>
                      {i.status || 'Unknown'}
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
