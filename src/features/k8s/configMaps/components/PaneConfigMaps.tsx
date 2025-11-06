import { useState, useCallback } from 'react';
import { V1ConfigMap, V1Namespace } from '@kubernetes/client-node';
import { Td } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { PaneGeneric } from '../../generic/components/PaneGeneric';
import { ColumnDef } from '@/components/common/TableHeader';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import { templateConfigMap } from '../../templates/configMap';
import { SidebarConfigMaps } from './SidebarConfigMaps';

export interface PaneConfigMapsProps {
  selectedNamespaces: string[];
  onSelectNamespace: (namespaces: string[]) => void;
  namespaceList: V1Namespace[];
  items: V1ConfigMap[];
  loading: boolean;
  error: string;
  onDelete: (configMaps: V1ConfigMap[]) => Promise<void>;
  onCreate?: (manifest: V1ConfigMap) => Promise<V1ConfigMap | undefined>;
  onUpdate?: (manifest: V1ConfigMap) => Promise<V1ConfigMap | undefined>;
  contextName?: string;
  creating?: boolean;
  updating?: boolean;
  deleting?: boolean;
}

export default function PaneConfigMaps({
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
}: PaneConfigMapsProps) {
  const [sortBy, setSortBy] = useState<string>('metadata');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const handleDeleteSelected = useCallback(
    async (toDelete: V1ConfigMap[]) => {
      if (!toDelete.length) return;
      await onDelete(toDelete);
    },
    [onDelete]
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

  const renderSidebar = useCallback(
    (
      item: V1ConfigMap,
      actions: {
        setItem: (item: V1ConfigMap | null) => void;
        onDelete?: (item: V1ConfigMap) => void;
        onEdit?: (item: V1ConfigMap) => void;
      }
    ) => (
      <SidebarConfigMaps
        item={item}
        setItem={actions.setItem}
        onDelete={actions.onDelete}
        onEdit={actions.onEdit}
        updating={updating}
        deleting={deleting}
      />
    ),
    [updating, deleting]
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
      renderSidebar={renderSidebar}
      contextName={contextName}
      creating={creating}
      deleting={deleting}
    />
  );
}
