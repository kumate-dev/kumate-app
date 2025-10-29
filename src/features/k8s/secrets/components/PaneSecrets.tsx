import { useState, useCallback } from 'react';
import { V1Secret, V1Namespace } from '@kubernetes/client-node';
import { Td } from '@/components/ui/table';
import { PaneResource } from '../../common/components/PaneGeneric';
import { ColumnDef, TableHeader } from '../../../../components/common/TableHeader';
import { BadgeNamespaces } from '../../common/components/BadgeNamespaces';
import AgeCell from '@/components/common/AgeCell';
import { BadgeStatus } from '../../common/components/BadgeStatus';
import { getSecretTypeStatus } from '../utils/secretTypeStatus';

export interface PaneSecretsProps {
  selectedNamespaces: string[];
  onSelectNamespace: (namespaces: string[]) => void;
  namespaceList: V1Namespace[];
  items: V1Secret[];
  loading: boolean;
  error: string;
  onDeleteSecrets: (secrets: V1Secret[]) => Promise<void>;
}

export default function PaneSecrets({
  selectedNamespaces,
  onSelectNamespace,
  namespaceList,
  items,
  loading,
  error,
  onDeleteSecrets,
}: PaneSecretsProps) {
  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState<keyof V1Secret>('metadata');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedItems, setSelectedItems] = useState<V1Secret[]>([]);

  const toggleItem = useCallback((secret: V1Secret) => {
    setSelectedItems((prev) =>
      prev.includes(secret) ? prev.filter((s) => s !== secret) : [...prev, secret]
    );
  }, []);

  const toggleAll = useCallback(
    (checked: boolean) => {
      setSelectedItems(checked ? [...items] : []);
    },
    [items]
  );

  const handleDeleteSelected = useCallback(async () => {
    if (!selectedItems.length) return;
    await onDeleteSecrets(selectedItems);
    setSelectedItems([]);
  }, [selectedItems, onDeleteSecrets]);

  const getDataKeys = (secret: V1Secret): string => {
    return secret.data ? Object.keys(secret.data).join(', ') : '-';
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
      onToggleAll={toggleAll}
      selectedItems={selectedItems}
      totalItems={items}
    />
  );

  const renderRow = (secret: V1Secret) => {
    const dataKeys = getDataKeys(secret);

    return (
      <>
        <Td className="max-w-truncate align-middle">
          <span className="block truncate" title={secret.metadata?.name}>
            {secret.metadata?.name}
          </span>
        </Td>
        <Td>
          <BadgeNamespaces name={secret.metadata?.namespace ?? ''} />
        </Td>
        <Td>
          <BadgeStatus status={getSecretTypeStatus(secret)} />
        </Td>
        <Td className="max-w-truncate">
          <span className="block truncate" title={dataKeys}>
            {dataKeys}
          </span>
        </Td>
        <AgeCell timestamp={secret.metadata?.creationTimestamp ?? ''} />
      </>
    );
  };

  return (
    <PaneResource
      items={items}
      loading={loading}
      error={error}
      query={q}
      onQueryChange={setQ}
      namespaceList={namespaceList}
      selectedNamespaces={selectedNamespaces}
      onSelectNamespace={onSelectNamespace}
      selectedItems={selectedItems}
      onToggleItem={toggleItem}
      onDeleteSelected={handleDeleteSelected}
      colSpan={columns.length + 1}
      tableHeader={tableHeader}
      renderRow={renderRow}
    />
  );
}
