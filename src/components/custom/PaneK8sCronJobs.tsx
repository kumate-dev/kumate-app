import { useState } from 'react';
import { PaneK8sResource, PaneK8sResourceContextProps } from './PaneK8sResource';
import { useNamespaceStore } from '@/state/namespaceStore';
import { useSelectedNamespaces } from '@/hooks/useSelectedNamespaces';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import { listCronJobs, watchCronJobs, CronJobItem } from '@/services/cronJobs';
import { ColumnDef, TableHeader } from './TableHeader';
import { Td, Tr } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import AgeCell from '@/components/custom/AgeCell';
import { BadgeVariant } from '@/types/variant';
import { useFilteredItems } from '@/hooks/useFilteredItems';
import { BadgeK8sNamespaces } from './BadgeK8sNamespaces';

export default function PaneK8sCronJobs({ context }: PaneK8sResourceContextProps) {
  const selectedNamespaces = useNamespaceStore((s) => s.selectedNamespaces);
  const setSelectedNamespaces = useNamespaceStore((s) => s.setSelectedNamespaces);
  const namespaceList = useSelectedNamespaces(context);

  const { items, loading, error } = useListK8sResources<CronJobItem>(
    listCronJobs,
    watchCronJobs,
    context,
    selectedNamespaces
  );

  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState<keyof CronJobItem>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const filtered = useFilteredItems(
    items,
    selectedNamespaces,
    q,
    ['name', 'namespace'],
    sortBy,
    sortOrder
  );

  const suspendVariant = (suspend: boolean | string): BadgeVariant => {
    switch (suspend) {
      case true:
      case 'true':
        return 'warning';
      case false:
      case 'false':
        return 'success';
      default:
        return 'default';
    }
  };

  const columns: ColumnDef<keyof CronJobItem | ''>[] = [
    { label: 'Name', key: 'name' },
    { label: 'Namespace', key: 'namespace' },
    { label: 'Schedule', key: 'schedule' },
    { label: 'Suspend', key: 'suspend' },
    { label: 'Last Schedule', key: 'last_schedule' },
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
      namespaceList={namespaceList}
      selectedNamespaces={selectedNamespaces}
      onSelectNamespace={setSelectedNamespaces}
      colSpan={columns.length}
      tableHeader={tableHeader}
      renderRow={(f) => (
        <Tr key={`${f.namespace}/${f.name}`}>
          <Td className="max-w-truncate">
            <span className="block truncate" title={f.name}>
              {f.name}
            </span>
          </Td>
          <BadgeK8sNamespaces name={f.namespace} />
          <Td>{f.schedule || '-'}</Td>
          <Td>
            <Badge variant={suspendVariant(f.suspend)}>{String(f.suspend)}</Badge>
          </Td>
          <AgeCell timestamp={f.last_schedule || ''} />
          <AgeCell timestamp={f.creation_timestamp || ''} />
          <Td>
            <button className="text-white/60 hover:text-white/80">⋮</button>
          </Td>
        </Tr>
      )}
    />
  );
}
