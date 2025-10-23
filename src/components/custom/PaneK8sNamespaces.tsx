import { useState } from 'react';
import { Td, Tr } from '@/components/ui/table';
import { useK8sResources } from '@/hooks/useK8sResources';
import { useFilteredItems } from '@/hooks/useFilteredItems';
import { listNamespaces, NamespaceItem, watchNamespaces } from '@/services/namespaces';
import { Badge } from '@/components/ui/badge';
import AgeCell from '@/components/custom/AgeCell';
import { ColumnDef, TableHeader } from './TableHeader';
import { PaneK8sResource, PaneK8sResourceContextProps } from './PaneK8sResource';

export default function PaneK8sNamespaces({ context }: PaneK8sResourceContextProps) {
  const { items, loading, error } = useK8sResources<NamespaceItem>(
    listNamespaces,
    watchNamespaces,
    context
  );

  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState<keyof NamespaceItem>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const filtered = useFilteredItems(items, [], q, ['name'], sortBy, sortOrder);

  function statusVariant(status: string) {
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

  const tableHeader = (
    <TableHeader
      columns={columns}
      sortBy={sortBy}
      sortOrder={sortOrder}
      setSortBy={setSortBy}
      setSortOrder={setSortOrder}
    />
  );

  return (
    <PaneK8sResource
      items={filtered}
      loading={loading}
      error={error ?? ''}
      query={q}
      onQueryChange={setQ}
      showNamespace={false}
      colSpan={columns.length}
      tableHeader={tableHeader}
      renderRow={(f) => (
        <Tr key={f.name}>
          <Td className="max-w-truncate">
            <span className="block truncate" title={f.name}>
              {f.name}
            </span>
          </Td>
          <Td>
            <Badge variant={statusVariant(f.status || 'Unknown')}>{f.status || 'Unknown'}</Badge>
          </Td>
          <AgeCell timestamp={f.creation_timestamp || ''} />
          <Td>
            <button className="text-white/60 hover:text-white/80">⋮</button>
          </Td>
        </Tr>
      )}
    />
  );
}
