import { useState } from 'react';
import { PaneK8sResource } from './PaneK8sResource';
import { useNamespaceStore } from '@/state/namespaceStore';
import { useSelectedNamespaces } from '@/hooks/useSelectedNamespaces';
import { useK8sResources } from '@/hooks/useK8sResources';
import { DaemonSetItem, listDaemonSets, watchDaemonSets } from '@/services/daemonsets';
import { useFilteredItems } from '@/hooks/useFilteredItems';
import { ColumnDef, TableHeader } from './TableHeader';
import { Td, Tr } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import AgeCell from '@/components/custom/AgeCell';
import { readyVariant } from '@/utils/k8s';
import { K8sContext } from '@/services/contexts';
import { BadgeVariant } from '@/types/variant';

interface PaneK8sDaemonSetProps {
  context?: K8sContext | null;
}

type SortKey = keyof DaemonSetItem;

export default function PaneK8sDaemonSet({ context }: PaneK8sDaemonSetProps) {
  const selectedNamespaces = useNamespaceStore((s) => s.selectedNamespaces);
  const setSelectedNamespaces = useNamespaceStore((s) => s.setSelectedNamespaces);
  const namespaceList = useSelectedNamespaces(context);

  const { items, loading, error } = useK8sResources<DaemonSetItem>(
    listDaemonSets,
    watchDaemonSets,
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

  const columns: ColumnDef<keyof DaemonSetItem | 'empty'>[] = [
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
        <Tr key={`${f.namespace}/${f.name}`}>
          <Td className="max-w-truncate">
            <span className="block truncate" title={f.name}>
              {f.name}
            </span>
          </Td>
          <Td>{f.namespace}</Td>
          <Td>
            <Badge variant={readyVariant(f.ready) as BadgeVariant}>{f.ready}</Badge>
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
