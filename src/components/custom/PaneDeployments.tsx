import { useState } from 'react';
import { Table, Tbody, Tr, Td, Badge } from '../ui';
import { readyVariant } from '../../utils/k8s';
import { useNamespaceStore } from '../../state/namespaceStore';
import { K8sContext } from '../../layouts/Sidebar';
import { useSelectedNamespaces } from '../../hooks/useSelectedNamespaces';
import { useK8sResources } from '../../hooks/useK8sResources';
import { DeploymentItem, listDeployments, watchDeployments } from '../../services/deployments';
import { useFilteredItems } from '../../hooks/useFilteredItems';
import { PaneTaskbar } from '../shared/PaneTaskbar';
import AgeCell from '../shared/AgeCell';
import { BadgeVariant } from '../../types/variant';
import { ColumnDef, TableHeader } from '../shared/TableHeader';

interface PaneDeploymentsProps {
  context?: K8sContext | null;
}

type SortKey = keyof DeploymentItem;

export default function PaneDeployments({ context }: PaneDeploymentsProps) {
  const selectedNamespaces = useNamespaceStore((s) => s.selectedNamespaces);
  const setSelectedNamespaces = useNamespaceStore((s) => s.setSelectedNamespaces);

  const namespaceList = useSelectedNamespaces(context);

  const { items, loading, error } = useK8sResources<DeploymentItem>(
    listDeployments,
    watchDeployments,
    context,
    selectedNamespaces
  );

  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const filtered = useFilteredItems(
    items,
    selectedNamespaces,
    q,
    ['name', 'namespace'],
    sortBy,
    sortOrder
  );

  console.log(filtered);

  function statusVariant(s: string): BadgeVariant {
    switch (s) {
      case 'Available':
        return 'success';
      case 'Progressing':
      case 'Scaling':
        return 'warning';
      case 'Terminating':
        return 'secondary';
      case 'Failed':
      case 'Unavailable':
        return 'error';
      default:
        return 'default';
    }
  }

  const columns: ColumnDef<keyof DeploymentItem | 'empty'>[] = [
    { label: 'Name', key: 'name' },
    { label: 'Namespace', key: 'namespace' },
    { label: 'Ready', key: 'ready' },
    { label: 'Age', key: 'creation_timestamp' },
    { label: 'Status', key: 'status' },
  ];

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
          <TableHeader
            columns={columns}
            sortBy={sortBy}
            sortOrder={sortOrder}
            setSortBy={setSortBy}
            setSortOrder={setSortOrder}
          />
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
              filtered.map((f) => (
                <Tr key={`${f.namespace}-${f.name}`}>
                  <Td className="font-medium">{f.name}</Td>
                  <Td className="text-white/80">{f.namespace}</Td>
                  <Td>
                    <Badge variant={readyVariant(f.ready)}>{f.ready}</Badge>
                  </Td>
                  <AgeCell timestamp={f.creation_timestamp || ''} />
                  <Td>
                    <Badge variant={statusVariant(f.status || '')}>{f.status || ''}</Badge>
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
