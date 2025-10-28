import { useState, useCallback } from 'react';
import { Td } from '@/components/ui/table';
import { PaneK8sResource, PaneK8sResourceContextProps } from './PaneK8sResource';
import { useNamespaceStore } from '@/state/namespaceStore';
import { useSelectedNamespaces } from '@/hooks/useSelectedNamespaces';
import { useListK8sResources } from '@/hooks/useListK8sResources';
import { listSecrets, watchSecrets, deleteSecrets } from '@/services/secrets';
import { V1Secret } from '@kubernetes/client-node';
import { useFilteredItems } from '@/hooks/useFilteredItems';
import { ColumnDef, TableHeader } from './TableHeader';
import { BadgeK8sNamespaces } from './BadgeK8sNamespaces';
import AgeCell from '@/components/custom/AgeCell';
import { Badge } from '@/components/ui/badge';
import { useDeleteK8sResources } from '@/hooks/useDeleteK8sResources';
import { toast } from 'sonner';
import { BadgeVariant } from '@/types/variant';

export default function PaneK8sSecrets({ context }: PaneK8sResourceContextProps) {
  const selectedNamespaces = useNamespaceStore((s) => s.selectedNamespaces);
  const setSelectedNamespaces = useNamespaceStore((s) => s.setSelectedNamespaces);
  const namespaceList = useSelectedNamespaces(context);

  const { items, loading, error } = useListK8sResources<V1Secret>(
    listSecrets,
    watchSecrets,
    context,
    selectedNamespaces
  );

  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState<keyof V1Secret>('metadata');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedSecrets, setSelectedSecrets] = useState<V1Secret[]>([]);

  const filtered = useFilteredItems(
    items,
    selectedNamespaces,
    q,
    ['metadata.name', 'metadata.namespace', 'type'],
    sortBy,
    sortOrder
  );

  const { handleDeleteResources } = useDeleteK8sResources<V1Secret>(deleteSecrets, context);

  const toggleSecret = useCallback((secret: V1Secret) => {
    setSelectedSecrets((prev) =>
      prev.includes(secret) ? prev.filter((s) => s !== secret) : [...prev, secret]
    );
  }, []);

  const toggleAllSecrets = useCallback(
    (checked: boolean) => {
      setSelectedSecrets(checked ? [...filtered] : []);
    },
    [filtered]
  );

  const handleDeleteSelected = useCallback(async () => {
    if (!selectedSecrets.length) return toast.error('No Secrets selected');
    await handleDeleteResources(selectedSecrets);
    setSelectedSecrets([]);
  }, [selectedSecrets, handleDeleteResources]);

  const typeVariant = (type?: string): BadgeVariant => {
    switch (type) {
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

  const columns: ColumnDef<keyof V1Secret | ''>[] = [
    { label: 'Name', key: 'metadata' },
    { label: 'Namespace', key: 'metadata' },
    { label: 'Type', key: 'type' },
    { label: 'Data Keys', key: 'data' },
    { label: 'Age', key: 'metadata' },
  ];

  const tableHeader = (
    <TableHeader
      columns={columns}
      sortBy={sortBy}
      sortOrder={sortOrder}
      setSortBy={setSortBy}
      setSortOrder={setSortOrder}
      onToggleAll={toggleAllSecrets}
      selectedItems={selectedSecrets}
      totalItems={filtered}
    />
  );

  const renderRow = (secret: V1Secret) => (
    <>
      <Td className="max-w-truncate align-middle">
        <span className="block truncate" title={secret.metadata?.name}>
          {secret.metadata?.name}
        </span>
      </Td>
      <Td>
        <BadgeK8sNamespaces name={secret.metadata?.namespace ?? ''} />
      </Td>
      <Td>
        <Badge variant={typeVariant(secret.type)}>{secret.type ?? '-'}</Badge>
      </Td>
      <Td className="max-w-truncate">
        <span
          className="block truncate"
          title={secret.data ? Object.keys(secret.data).join(', ') : ''}
        >
          {secret.data ? Object.keys(secret.data).join(', ') : '-'}
        </span>
      </Td>
      <AgeCell timestamp={secret.metadata?.creationTimestamp ?? ''} />
      <Td>
        <button className="text-white/60 hover:text-white/80">⋮</button>
      </Td>
    </>
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
      selectedItems={selectedSecrets}
      onToggleItem={toggleSecret}
      onToggleAll={toggleAllSecrets}
      onDeleteSelected={handleDeleteSelected}
      colSpan={columns.length + 1}
      tableHeader={tableHeader}
      renderRow={renderRow}
    />
  );
}
