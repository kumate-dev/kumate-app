import { useState } from 'react';
import { Table, Tbody, Td, Tr } from '@/components/ui/table';
import { useK8sResources } from '@/hooks/useK8sResources';
import { useFilteredItems } from '@/hooks/useFilteredItems';
import AgeCell from '@/components/custom/AgeCell';
import { PaneSearch } from '@/components/custom/PaneSearch';
import { listNamespaces, NamespaceItem, watchNamespaces } from '@/services/namespaces';
import { BadgeVariant } from '@/types/variant';
import { ColumnDef, TableHeader } from '@/components/custom/TableHeader';
import { K8sContext } from '@/services/contexts';
import { ErrorMessage } from '@/components/custom/ErrorMessage';
import { Badge } from '@/components/ui/badge';
import { PaneTaskbar } from './PaneTaskbar';

interface PaneNamespacesProps {
  context?: K8sContext | null;
}

type SortKey = keyof NamespaceItem;

export default function PaneNamespaces({ context }: PaneNamespacesProps) {
  const { items, loading, error } = useK8sResources<NamespaceItem>(
    listNamespaces,
    watchNamespaces,
    context
  );

  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const filtered = useFilteredItems(items, [], q, ['name'], sortBy, sortOrder);

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

  const columns: ColumnDef<keyof NamespaceItem | 'empty'>[] = [
    { label: 'Name', key: 'name' },
    { label: 'Status', key: 'status' },
    { label: 'Age', key: 'creation_timestamp' },
  ];

  return (
    <div className="flex h-full flex-col">
      <PaneTaskbar query={q} onQueryChange={setQ} showNamespace={false} />

      <ErrorMessage message={error} />

      <div className="flex-1 gap-2 overflow-hidden rounded-xl border border-white/10 bg-neutral-900/60">
        <div className="h-full overflow-auto">
          <div className="min-w-max">
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
                  filtered.map((f) => (
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
      </div>
    </div>
  );
}
