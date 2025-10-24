import { useState } from 'react';
import { PaneK8sResource, PaneK8sResourceContextProps } from './PaneK8sResource';
import { useNamespaceStore } from '@/state/namespaceStore';
import { useSelectedNamespaces } from '@/hooks/useSelectedNamespaces';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import { listLimitRanges, watchLimitRanges, LimitRangeItem } from '@/services/limitRanges';
import { ColumnDef, TableHeader } from './TableHeader';
import { Td, Tr } from '@/components/ui/table';
import AgeCell from '@/components/custom/AgeCell';
import { useFilteredItems } from '@/hooks/useFilteredItems';
import { BadgeK8sNamespaces } from './BadgeK8sNamespaces';

export default function PaneK8sLimitRanges({ context }: PaneK8sResourceContextProps) {
  const selectedNamespaces = useNamespaceStore((s) => s.selectedNamespaces);
  const setSelectedNamespaces = useNamespaceStore((s) => s.setSelectedNamespaces);
  const namespaceList = useSelectedNamespaces(context);

  const { items, loading, error } = useListK8sResources<LimitRangeItem>(
    listLimitRanges,
    watchLimitRanges,
    context,
    selectedNamespaces
  );

  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState<keyof LimitRangeItem>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const filtered = useFilteredItems(
    items,
    selectedNamespaces,
    q,
    ['name', 'namespace'],
    sortBy,
    sortOrder
  );

  function renderLimitMap(map?: Record<string, string>): { display: string; title: string } {
    if (!map || Object.keys(map).length === 0) return { display: '-', title: '-' };
    const text = Object.entries(map)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    return { display: text, title: text };
  }

  const columns: ColumnDef<keyof LimitRangeItem | ''>[] = [
    { label: 'Name', key: 'name' },
    { label: 'Namespace', key: 'namespace' },
    { label: 'Type', key: 'type_' },
    { label: 'Min', key: 'min' },
    { label: 'Max', key: 'max' },
    { label: 'Default', key: 'default' },
    { label: 'Default Request', key: 'defaultRequest' },
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
            {f.name}
          </Td>
          <BadgeK8sNamespaces name={f.namespace} />
          <Td>{f.type_ || '-'}</Td>
          <Td title={renderLimitMap(f.min).title}>{renderLimitMap(f.min).display}</Td>
          <Td title={renderLimitMap(f.max).title}>{renderLimitMap(f.max).display}</Td>
          <Td title={renderLimitMap(f.default).title}>{renderLimitMap(f.default).display}</Td>
          <Td title={renderLimitMap(f.defaultRequest).title}>
            {renderLimitMap(f.defaultRequest).display}
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
