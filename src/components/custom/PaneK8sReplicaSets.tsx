import { useState } from 'react';
import { PaneK8sResource, PaneK8sResourceContextProps } from './PaneK8sResource';
import { useNamespaceStore } from '@/state/namespaceStore';
import { useSelectedNamespaces } from '@/hooks/useSelectedNamespaces';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import { listReplicaSets, watchReplicaSets, ReplicaSetItem } from '@/services/replicaSets';
import { ColumnDef, TableHeader } from './TableHeader';
import { Td, Tr } from '@/components/ui/table';
import AgeCell from '@/components/custom/AgeCell';
import { Badge } from '@/components/ui/badge';
import { readyVariant } from '@/utils/k8s';
import { useFilteredItems } from '@/hooks/useFilteredItems';
import { BadgeK8sNamespaces } from './BadgeK8sNamespaces';

export default function PaneK8sReplicaSets({ context }: PaneK8sResourceContextProps) {
  const selectedNamespaces = useNamespaceStore((s) => s.selectedNamespaces);
  const setSelectedNamespaces = useNamespaceStore((s) => s.setSelectedNamespaces);
  const namespaceList = useSelectedNamespaces(context);

  const { items, loading, error } = useListK8sResources<ReplicaSetItem>(
    listReplicaSets,
    watchReplicaSets,
    context,
    selectedNamespaces
  );

  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState<keyof ReplicaSetItem>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const filtered = useFilteredItems(
    items,
    selectedNamespaces,
    q,
    ['name', 'namespace'],
    sortBy,
    sortOrder
  );

  const columns: ColumnDef<keyof ReplicaSetItem | ''>[] = [
    { label: 'Name', key: 'name' },
    { label: 'Namespace', key: 'namespace' },
    { label: 'Ready', key: 'ready' },
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
        <Tr key={`${f.namespace}-${f.name}`}>
          <Td className="max-w-truncate">
            <span className="block truncate" title={f.name}>
              {f.name}
            </span>
          </Td>
          <BadgeK8sNamespaces name={f.namespace} />
          <Td>
            <Badge variant={readyVariant(f.ready)}>{f.ready}</Badge>
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
