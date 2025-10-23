import { useState } from 'react';
import { PaneK8sResource, PaneK8sResourceContextProps } from './PaneK8sResource';
import { useNamespaceStore } from '@/state/namespaceStore';
import { useSelectedNamespaces } from '@/hooks/useSelectedNamespaces';
import { useK8sResources } from '@/hooks/useK8sResources';
import { listSecrets, watchSecrets, SecretItem } from '@/services/secrets';
import { ColumnDef, TableHeader } from './TableHeader';
import { Td, Tr } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import AgeCell from '@/components/custom/AgeCell';
import { BadgeVariant } from '@/types/variant';
import { useFilteredItems } from '@/hooks/useFilteredItems';

export default function PaneK8sSecrets({ context }: PaneK8sResourceContextProps) {
  const selectedNamespaces = useNamespaceStore((s) => s.selectedNamespaces);
  const setSelectedNamespaces = useNamespaceStore((s) => s.setSelectedNamespaces);
  const namespaceList = useSelectedNamespaces(context);

  const { items, loading, error } = useK8sResources<SecretItem>(
    listSecrets,
    watchSecrets,
    context,
    selectedNamespaces
  );

  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState<keyof SecretItem>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const filtered = useFilteredItems(
    items,
    selectedNamespaces,
    q,
    ['name', 'namespace', 'type_'],
    sortBy,
    sortOrder
  );

  const typeVariant = (type_: string): BadgeVariant => {
    switch (type_) {
      case 'Opaque':
        return 'secondary';
      case 'kubernetes.io/service-account-token':
        return 'warning';
      case 'kubernetes.io/dockerconfigjson':
        return 'success';
      case 'kubernetes.io/tls':
        return 'error';
      default:
        return 'default';
    }
  };

  const columns: ColumnDef<keyof SecretItem | 'empty'>[] = [
    { label: 'Name', key: 'name' },
    { label: 'Namespace', key: 'namespace' },
    { label: 'Type', key: 'type_' },
    { label: 'Data Keys', key: 'data_keys' },
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
          <Td>
            <Badge>{f.namespace}</Badge>
          </Td>
          <Td>
            <Badge variant={typeVariant(f.type_)}>{f.type_}</Badge>
          </Td>
          <Td className="max-w-truncate">
            <span className="block truncate" title={f.data_keys.join(', ')}>
              {f.data_keys.join(', ')}
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
