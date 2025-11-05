import { useState, useCallback } from 'react';
import { V1Secret, V1Namespace } from '@kubernetes/client-node';
import { Td } from '@/components/ui/table';
import { PaneGeneric } from '../../generic/components/PaneGeneric';
import { ColumnDef } from '../../../../components/common/TableHeader';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import AgeCell from '@/components/common/AgeCell';
import { BadgeStatus } from '../../generic/components/BadgeStatus';
import { getSecretTypeStatus } from '../utils/secretTypeStatus';
import { templateSecret } from '../../templates/secret';

export interface PaneSecretsProps {
  selectedNamespaces: string[];
  onSelectNamespace: (namespaces: string[]) => void;
  namespaceList: V1Namespace[];
  items: V1Secret[];
  loading: boolean;
  error: string;
  onDeleteSecrets: (secrets: V1Secret[]) => Promise<void>;
  onCreate?: (manifest: V1Secret) => Promise<V1Secret | undefined>;
  onUpdate?: (manifest: V1Secret) => Promise<V1Secret | undefined>;
  contextName?: string;
}

export default function PaneSecrets({
  selectedNamespaces,
  onSelectNamespace,
  namespaceList,
  items,
  loading,
  error,
  onDeleteSecrets,
  onCreate,
  onUpdate,
  contextName,
}: PaneSecretsProps) {
  const [sortBy, setSortBy] = useState<string>('metadata');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const handleDeleteSelected = useCallback(
    async (toDelete: V1Secret[]) => {
      if (!toDelete.length) return;
      await onDeleteSecrets(toDelete);
    },
    [onDeleteSecrets]
  );

  const getDataKeys = (secret: V1Secret): string => {
    return secret.data ? Object.keys(secret.data).join(', ') : '-';
  };

  const columns: ColumnDef<string>[] = [
    { label: 'Name', key: 'metadata' },
    { label: 'Namespace', key: 'metadata' },
    { label: 'Type', key: 'type' },
    { label: 'Data Keys', key: 'data' },
    { label: 'Age', key: 'metadata' },
  ];

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
    <PaneGeneric
      items={items}
      loading={loading}
      error={error}
      namespaceList={namespaceList}
      selectedNamespaces={selectedNamespaces}
      onSelectNamespace={onSelectNamespace}
      columns={columns}
      sortBy={sortBy}
      sortOrder={sortOrder}
      setSortBy={setSortBy}
      setSortOrder={setSortOrder}
      onDelete={handleDeleteSelected}
      renderRow={renderRow}
      yamlTemplate={templateSecret}
      onCreate={onCreate}
      onUpdate={onUpdate}
      contextName={contextName}
    />
  );
}
