import { useState } from 'react';
import { Table, Thead, Tbody, Tr, Th, Td } from '@/components/ui/table';
import { useK8sResources } from '@/hooks/useK8sResources';
import { useFilteredItems } from '@/hooks/useFilteredItems';
import AgeCell from '@/components/custom/AgeCell';
import { PaneSearch } from '@/components/custom/PaneSearch';
import { listNamespaces, NamespaceItem, watchNamespaces } from '@/services/namespaces';
import { BadgeVariant } from '@/types/variant';
import { K8sContext } from '@/services/contexts';
import { ErrorMessage } from '@/components/custom/ErrorMessage';
import { Badge } from '@/components/ui/badge';

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

      <ErrorMessage message={error} />

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
                  <Td className="max-w-truncate">
                    <span className="block truncate" title={f.name}>
                      {f.name}
                    </span>
                  </Td>
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
