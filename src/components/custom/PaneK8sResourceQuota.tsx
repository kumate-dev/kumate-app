import { useState } from 'react';
import { PaneK8sResource } from './PaneK8sResource';
import { useNamespaceStore } from '@/state/namespaceStore';
import { useSelectedNamespaces } from '@/hooks/useSelectedNamespaces';
import { useK8sResources } from '@/hooks/useK8sResources';
import {
  listResourceQuotas,
  watchResourceQuotas,
  ResourceQuotaItem,
} from '@/services/resourceQuotas';
import { ColumnDef, TableHeader } from './TableHeader';
import { Td, Tr } from '@/components/ui/table';
import AgeCell from '@/components/custom/AgeCell';
import { K8sContext } from '@/services/contexts';
import { useFilteredItems } from '@/hooks/useFilteredItems';

interface PaneResourceQuotaProps {
  context?: K8sContext | null;
}

export default function PaneK8sResourceQuota({ context }: PaneResourceQuotaProps) {
  const selectedNamespaces = useNamespaceStore((s) => s.selectedNamespaces);
  const setSelectedNamespaces = useNamespaceStore((s) => s.setSelectedNamespaces);
  const namespaceList = useSelectedNamespaces(context);

  const { items, loading, error } = useK8sResources<ResourceQuotaItem>(
    listResourceQuotas,
    watchResourceQuotas,
    context,
    selectedNamespaces
  );

  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState<keyof ResourceQuotaItem>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const filtered = useFilteredItems(
    items,
    selectedNamespaces,
    q,
    ['name', 'namespace'],
    sortBy,
    sortOrder
  );

  function renderKeyValue(items?: [string, string][]): { display: string; title: string } {
    if (!items || items.length === 0) return { display: '-', title: '-' };

    const text = items.map(([k, v]) => `${k}: ${v}`).join(', ');
    return { display: text, title: text };
  }

  const columns: ColumnDef<keyof ResourceQuotaItem | 'empty'>[] = [
    { label: 'Name', key: 'name' },
    { label: 'Namespace', key: 'namespace' },
    { label: 'Hard', key: 'hard' },
    { label: 'Used', key: 'used' },
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
          <Td className="max-w-truncate">
            <span className="block truncate" title={renderKeyValue(f.hard).title}>
              {renderKeyValue(f.hard).display}
            </span>
          </Td>
          <Td className="max-w-truncate">
            <span className="block truncate" title={renderKeyValue(f.used).title}>
              {renderKeyValue(f.used).display}
            </span>
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
