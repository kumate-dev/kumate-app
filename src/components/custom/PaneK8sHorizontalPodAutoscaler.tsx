import { useState } from 'react';
import { PaneK8sResource } from './PaneK8sResource';
import { useNamespaceStore } from '@/state/namespaceStore';
import { useSelectedNamespaces } from '@/hooks/useSelectedNamespaces';
import { useK8sResources } from '@/hooks/useK8sResources';
import {
  listHorizontalPodAutoscalers,
  watchHorizontalPodAutoscalers,
  HorizontalPodAutoscalerItem,
} from '@/services/horizontalPodAutoscalers';
import { ColumnDef, TableHeader } from './TableHeader';
import { Td, Tr } from '@/components/ui/table';
import AgeCell from '@/components/custom/AgeCell';
import { K8sContext } from '@/services/contexts';
import { useFilteredItems } from '@/hooks/useFilteredItems';
import { Badge } from '../ui/badge';
import { BadgeVariant } from '@/types/variant';

interface PaneK8sHorizontalPodAutoscalersProps {
  context?: K8sContext | null;
}

export default function PaneK8sHorizontalPodAutoscalers({
  context,
}: PaneK8sHorizontalPodAutoscalersProps) {
  const selectedNamespaces = useNamespaceStore((s) => s.selectedNamespaces);
  const setSelectedNamespaces = useNamespaceStore((s) => s.setSelectedNamespaces);
  const namespaceList = useSelectedNamespaces(context);

  const { items, loading, error } = useK8sResources<HorizontalPodAutoscalerItem>(
    listHorizontalPodAutoscalers,
    watchHorizontalPodAutoscalers,
    context,
    selectedNamespaces
  );

  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState<keyof HorizontalPodAutoscalerItem>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const filtered = useFilteredItems(
    items,
    selectedNamespaces,
    q,
    ['name', 'namespace', 'target_ref'],
    sortBy,
    sortOrder
  );

  const statusVariant = (status: string): BadgeVariant => {
    switch (status) {
      case 'Active':
      case 'AbleToScale':
        return 'success';
      case 'Error':
      case 'Failed':
        return 'error';
      case 'Unknown':
      default:
        return 'default';
    }
  };

  const columns: ColumnDef<keyof HorizontalPodAutoscalerItem | 'empty'>[] = [
    { label: 'Name', key: 'name' },
    { label: 'Namespace', key: 'namespace' },
    { label: 'Target', key: 'target_ref' },
    { label: 'Min', key: 'min_replicas' },
    { label: 'Max', key: 'max_replicas' },
    { label: 'Current', key: 'current_replicas' },
    { label: 'Desired', key: 'desired_replicas' },
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
          <Td className="max-w-truncate" title={f.name}>
            <span className="block truncate">{f.name}</span>
          </Td>
          <Td>{f.namespace}</Td>
          <Td>{f.target_ref}</Td>
          <Td>{f.min_replicas ?? '-'}</Td>
          <Td>{f.max_replicas}</Td>
          <Td>{f.current_replicas ?? '-'}</Td>
          <Td>{f.desired_replicas ?? '-'}</Td>
          <AgeCell timestamp={f.creation_timestamp || ''} />
          <Td>
            <Badge variant={statusVariant(f.status)}>{f.status}</Badge>
          </Td>
          <Td>
            <button className="text-white/60 hover:text-white/80">⋮</button>
          </Td>
        </Tr>
      )}
    />
  );
}
