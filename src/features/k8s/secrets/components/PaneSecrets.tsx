import { useState, useCallback, useMemo } from 'react';
import { V1Secret, V1Namespace } from '@kubernetes/client-node';
import { Td } from '@/components/ui/table';
import { PaneGeneric } from '../../generic/components/PaneGeneric';
import { ColumnDef } from '../../../../components/common/TableHeader';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import AgeCell from '@/components/common/AgeCell';
import { BadgeStatus } from '../../generic/components/BadgeStatus';
import { getSecretTypeStatus } from '../utils/secretTypeStatus';
import { templateSecret } from '../../templates/secret';
import { SidebarSecrets } from './SidebarSecrets';
import { useOptimisticSortedItems } from '@/hooks/useOptimisticSortedItems';

export interface PaneSecretsProps {
  selectedNamespaces: string[];
  onSelectNamespace: (namespaces: string[]) => void;
  namespaceList: V1Namespace[];
  items: V1Secret[];
  loading: boolean;
  error: string;
  onDelete: (secrets: V1Secret[]) => Promise<void>;
  onCreate?: (manifest: V1Secret) => Promise<V1Secret | undefined>;
  onUpdate?: (manifest: V1Secret) => Promise<V1Secret | undefined>;
  contextName?: string;
  creating?: boolean;
  updating?: boolean;
  deleting?: boolean;
}

export default function PaneSecrets({
  selectedNamespaces,
  onSelectNamespace,
  namespaceList,
  items,
  loading,
  error,
  onDelete,
  onCreate,
  onUpdate,
  contextName,
  creating = false,
  updating = false,
  deleting = false,
}: PaneSecretsProps) {
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const valueGetters = useMemo(
    () => ({
      name: (item: V1Secret) => item.metadata?.name || '',
      namespace: (item: V1Secret) => item.metadata?.namespace || '',
      type: (item: V1Secret) => getSecretTypeStatus(item).status,
      dataKeys: (item: V1Secret) => getDataKeys(item),
      age: (item: V1Secret) => new Date(item.metadata?.creationTimestamp || '').getTime(),
    }),
    []
  );

  const { sortedItems, onAfterCreate } = useOptimisticSortedItems<V1Secret>({
    items,
    sortBy,
    sortOrder,
    valueGetters,
    selectedNamespaces,
    isNamespaced: true,
  });

  const getDataKeys = (secret: V1Secret): string => {
    return secret.data ? Object.keys(secret.data).join(', ') : '-';
  };

  const columns: ColumnDef<string>[] = [
    { label: 'Name', key: 'name', sortable: true },
    { label: 'Namespace', key: 'namespace', sortable: true },
    { label: 'Type', key: 'type', sortable: true },
    { label: 'Age', key: 'age', sortable: true },
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

  const renderSidebar = useCallback(
    (
      item: V1Secret,
      actions: {
        setItem: (item: V1Secret | null) => void;
        onDelete?: (item: V1Secret) => void;
        onEdit?: (item: V1Secret) => void;
      }
    ) => (
      <SidebarSecrets
        item={item}
        setItem={actions.setItem}
        onDelete={actions.onDelete}
        onEdit={actions.onEdit}
        onUpdate={onUpdate}
        contextName={contextName}
        updating={updating}
        deleting={deleting}
      />
    ),
    [updating, deleting, contextName]
  );

  return (
    <PaneGeneric
      items={sortedItems}
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
      onDelete={onDelete}
      renderRow={renderRow}
      yamlTemplate={templateSecret}
      onCreate={onCreate}
      onUpdate={onUpdate}
      onAfterCreate={onAfterCreate}
      renderSidebar={renderSidebar}
      contextName={contextName}
      creating={creating}
      deleting={deleting}
    />
  );
}
