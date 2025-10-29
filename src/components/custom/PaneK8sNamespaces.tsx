import { useState } from 'react';
import { Td, Tr } from '@/components/ui/table';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import { useFilteredItems } from '@/hooks/useFilteredItems';
import { listNamespaces, watchNamespaces } from '@/api/k8s/namespaces';
import { V1Namespace } from '@kubernetes/client-node';
import { Badge } from '@/components/ui/badge';
import AgeCell from '@/components/custom/AgeCell';
import { ColumnDef, TableHeader } from './TableHeader';
import { PaneK8sResource, PaneK8sResourceContextProps } from './PaneK8sResource';

export default function PaneK8sNamespaces({ context }: PaneK8sResourceContextProps) {
  const { items, loading, error } = useListK8sResources<V1Namespace>(
    listNamespaces,
    watchNamespaces,
    context
  );

  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState<keyof V1Namespace>('metadata');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const filtered = useFilteredItems(
    items,
    [],
    q,
    ['metadata.name', 'status.phase'],
    sortBy,
    sortOrder
  );

  const statusVariant = (phase?: string) => {
    switch (phase) {
      case 'Active':
        return 'success';
      case 'Terminating':
        return 'warning';
      default:
        return 'default';
    }
  };

  const columns: ColumnDef<keyof V1Namespace | ''>[] = [
    { label: 'Name', key: 'metadata' },
    { label: 'Status', key: 'status' },
    { label: 'Age', key: 'metadata' },
    { label: '', key: '', sortable: false },
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

  const renderRow = (ns: V1Namespace) => (
    <Tr key={ns.metadata?.name}>
      <Td className="max-w-truncate" title={ns.metadata?.name}>
        {ns.metadata?.name}
      </Td>
      <Td>
        <Badge variant={statusVariant(ns.status?.phase)}>{ns.status?.phase || 'Unknown'}</Badge>
      </Td>
      <AgeCell timestamp={ns.metadata?.creationTimestamp || ''} />
      <Td>
        <button className="text-white/60 hover:text-white/80">⋮</button>
      </Td>
    </Tr>
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
      renderRow={renderRow}
    />
  );
}
