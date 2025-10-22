import { useState } from 'react';
import { Table, Tbody, Tr, Td, Badge } from '../ui';
import { readyVariant } from '../../utils/k8s';
import { useNamespaceStore } from '../../state/namespaceStore';
import { useSelectedNamespaces } from '../../hooks/useSelectedNamespaces';
import { useK8sResources } from '../../hooks/useK8sResources';
import { DeploymentItem, listDeployments, watchDeployments } from '../../services/deployments';
import { useFilteredItems } from '../../hooks/useFilteredItems';
import { PaneTaskbar } from '../shared/PaneTaskbar';
import AgeCell from '../shared/AgeCell';
import { BadgeVariant } from '../../types/variant';
import { ColumnDef, TableHeader } from '../shared/TableHeader';
import { K8sContext } from '../../services/contexts';
import { ErrorMessage } from '../shared/ErrorMessage';

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

      <ErrorMessage message={error} />

      <div className="overflow-auto rounded-xl border border-white/10 bg-neutral-900/60 max-h-[600px]">
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
                  <Td className="max-w-truncate">
                    <span className="block truncate" title={f.name}>
                      {f.name}
                    </span>
                  </Td>
                  <Td>{f.namespace}</Td>
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
