import { useState } from 'react';
import { useNamespaceStore } from '@/state/namespaceStore';
import { useSelectedNamespaces } from '@/hooks/useSelectedNamespaces';
import { useK8sResources } from '@/hooks/useK8sResources';
import { listStatefulSets, StatefulSetItem, watchStatefulSets } from '@/services/statefulsets';
import { useFilteredItems } from '@/hooks/useFilteredItems';
import { PaneTaskbar } from '@/components/custom/PaneTaskbar';
import AgeCell from '@/components/custom/AgeCell';
import { ColumnDef, TableHeader } from '@/components/custom/TableHeader';
import { K8sContext } from '@/services/contexts';
import { ErrorMessage } from '@/components/custom/ErrorMessage';
import { Badge } from '@/components/ui/badge';
import { PaneK8sResource } from '@/components/custom/PaneK8sResource';
import { readyVariant } from '@/utils/k8s';

interface PaneK8sStatefulSetProps {
  context?: K8sContext | null;
}

type SortKey = keyof StatefulSetItem;

export default function PaneK8sStatefulSet({ context }: PaneK8sStatefulSetProps) {
  const selectedNamespaces = useNamespaceStore((s) => s.selectedNamespaces);
  const setSelectedNamespaces = useNamespaceStore((s) => s.setSelectedNamespaces);

  const namespaceList = useSelectedNamespaces(context);

  const { items, loading, error } = useK8sResources<StatefulSetItem>(
    listStatefulSets,
    watchStatefulSets,
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

  const columns: ColumnDef<keyof StatefulSetItem | 'empty'>[] = [
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
        <tr key={`${f.namespace}/${f.name}`}>
          <td className="max-w-truncate">
            <span className="block truncate" title={f.name}>
              {f.name}
            </span>
          </td>
          <td>{f.namespace}</td>
          <td>
            <Badge variant={readyVariant(f.ready)}>{f.ready}</Badge>
          </td>
          <AgeCell timestamp={f.creation_timestamp || ''} />
          <td>
            <button className="text-white/60 hover:text-white/80">⋮</button>
          </td>
        </tr>
      )}
    />
  );
}
