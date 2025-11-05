import { useState, useCallback } from 'react';
import { V1ConfigMap, V1Namespace } from '@kubernetes/client-node';
import { Td } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { PaneGeneric } from '../../generic/components/PaneGeneric';
import { ColumnDef } from '@/components/common/TableHeader';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import { templateConfigMap } from '../../templates/configMap';

export interface PaneConfigMapsProps {
  selectedNamespaces: string[];
  onSelectNamespace: (namespaces: string[]) => void;
  namespaceList: V1Namespace[];
  items: V1ConfigMap[];
  loading: boolean;
  error: string;
  onDeleteConfigMaps: (configMaps: V1ConfigMap[]) => Promise<void>;
  onCreate?: (manifest: V1ConfigMap) => Promise<V1ConfigMap | undefined>;
  onUpdate?: (manifest: V1ConfigMap) => Promise<V1ConfigMap | undefined>;
  contextName?: string;
}

export default function PaneConfigMaps({
  selectedNamespaces,
  onSelectNamespace,
  namespaceList,
  items,
  loading,
  error,
  onDeleteConfigMaps,
  onCreate,
  onUpdate,
  contextName,
}: PaneConfigMapsProps) {
  const [sortBy, setSortBy] = useState<string>('metadata');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const handleDeleteSelected = useCallback(
    async (toDelete: V1ConfigMap[]) => {
      if (!toDelete.length) return;
      await onDeleteConfigMaps(toDelete);
    },
    [onDeleteConfigMaps]
  );

  const columns: ColumnDef<string>[] = [
    { label: 'Name', key: 'metadata' },
    { label: 'Namespace', key: 'metadata' },
    { label: 'Keys', key: 'data' },
    { label: 'Age', key: 'metadata' },
  ];

  const renderRow = (cm: V1ConfigMap) => (
    <>
      <Td className="max-w-truncate align-middle">
        <span className="block truncate" title={cm.metadata?.name ?? ''}>
          {cm.metadata?.name}
        </span>
      </Td>
      <Td>
        <BadgeNamespaces name={cm.metadata?.namespace ?? ''} />
      </Td>
      <Td className="max-w-truncate align-middle" title={Object.keys(cm.data || {}).join(', ')}>
        {cm.data && Object.keys(cm.data).length > 0 ? (
          Object.keys(cm.data).join(', ')
        ) : (
          <span className="inline-block h-3 w-3 rounded-full bg-red-500" />
        )}
      </Td>
      <AgeCell timestamp={cm.metadata?.creationTimestamp} />
    </>
  );

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
      yamlTemplate={templateConfigMap}
      onCreate={onCreate}
      onUpdate={onUpdate}
      contextName={contextName}
    />
  );
}
