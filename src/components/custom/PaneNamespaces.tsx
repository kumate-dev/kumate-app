import { useState } from 'react';
import { Table, Thead, Tbody, Tr, Th, Td, Badge } from '../ui';
import { K8sContext } from '../../layouts/Sidebar';
import { useK8sResources } from '../../hooks/useK8sResources';
import { useFilteredItems } from '../../hooks/useFilteredItems';
import AgeCell from '../shared/AgeCell';
import { PaneSearch } from '../shared/PaneSearch';
import { listNamespaces, NamespaceItem, watchNamespaces } from '../../services/namespaces';
import { BadgeVariant } from '../../types/variant';

interface PaneNamespacesProps {
  context?: K8sContext | null;
}

export default function PaneNamespaces({ context }: PaneNamespacesProps) {
  const { items, loading, error } = useK8sResources<NamespaceItem>(
    listNamespaces,
    watchNamespaces,
    context
  );

  const [q, setQ] = useState('');
  const filtered = useFilteredItems(items, [], q, ['name']);

  function statusVariant(status: string): BadgeVariant {
    switch (status) {
      case 'Active':
        return 'success';

      case 'Terminating':
        return 'warning';

      default:
        return 'secondary';
    }
  }

  return (
    <div className="space-y-3">
      <PaneSearch query={q} onQueryChange={setQ} />

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
              <Th>Status</Th>
              <Th>Age</Th>
              <Th></Th>
            </Tr>
          </Thead>
          <Tbody>
            {loading && (
              <Tr>
                <Td colSpan={4} className="text-white/60">
                  Loading...
                </Td>
              </Tr>
            )}

            {!loading && filtered.length === 0 && (
              <Tr>
                <Td colSpan={4} className="text-white/60">
                  No namespaces
                </Td>
              </Tr>
            )}

            {!loading &&
              filtered.map((f: NamespaceItem) => (
                <Tr key={f.name}>
                  <Td className="font-medium">{f.name}</Td>
                  <Td>
                    <Badge variant={statusVariant(f.status || 'Unknown')}>
                      {f.status || 'Unknown'}
                    </Badge>
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
