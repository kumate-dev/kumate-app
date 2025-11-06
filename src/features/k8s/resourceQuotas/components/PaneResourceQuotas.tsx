import { useState, useCallback } from 'react';
import { V1ResourceQuota, V1Namespace } from '@kubernetes/client-node';
import { Td } from '@/components/ui/table';
import { PaneGeneric } from '../../generic/components/PaneGeneric';
import { SidebarResourceQuotas } from './SidebarResourceQuotas';
import { ColumnDef } from '../../../../components/common/TableHeader';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import AgeCell from '@/components/common/AgeCell';
import { renderKeyValue } from '../utils/renderKeyValue';
import { templateResourceQuota } from '../../templates/resourceQuota';

export interface PaneResourceQuotasProps {
  selectedNamespaces: string[];
  onSelectNamespace: (namespaces: string[]) => void;
  namespaceList: V1Namespace[];
  items: V1ResourceQuota[];
  loading: boolean;
  error: string;
  onDelete: (resourceQuotas: V1ResourceQuota[]) => Promise<void>;
  onCreate?: (manifest: V1ResourceQuota) => Promise<V1ResourceQuota | undefined>;
  onUpdate?: (manifest: V1ResourceQuota) => Promise<V1ResourceQuota | undefined>;
  contextName?: string;
  creating?: boolean;
  updating?: boolean;
  deleting?: boolean;
}

export default function PaneResourceQuotas({
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
  creating,
  updating,
  deleting,
}: PaneResourceQuotasProps) {
  const [sortBy, setSortBy] = useState<string>('metadata');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const handleDeleteSelected = useCallback(
    async (toDelete: V1ResourceQuota[]) => {
      if (!toDelete.length) return;
      await onDelete(toDelete);
    },
    [onDelete]
  );

  const columns: ColumnDef<string>[] = [
    { label: 'Name', key: 'metadata' },
    { label: 'Namespace', key: 'metadata' },
    { label: 'Hard', key: 'status' },
    { label: 'Used', key: 'status' },
    { label: 'Age', key: 'metadata' },
  ];

  const renderRow = (rq: V1ResourceQuota) => {
    const hardResources = renderKeyValue(rq.status?.hard as Record<string, string>);
    const usedResources = renderKeyValue(rq.status?.used as Record<string, string>);

    return (
      <>
        <Td className="max-w-truncate align-middle">
          <span className="block truncate" title={rq.metadata?.name}>
            {rq.metadata?.name}
          </span>
        </Td>
        <Td>
          <BadgeNamespaces name={rq.metadata?.namespace ?? ''} />
        </Td>
        <Td className="max-w-truncate" title={hardResources.title}>
          {hardResources.display}
        </Td>
        <Td className="max-w-truncate" title={usedResources.title}>
          {usedResources.display}
        </Td>
        <AgeCell timestamp={rq.metadata?.creationTimestamp ?? ''} />
      </>
    );
  };

  const renderSidebar = useCallback(
    (
      item: V1ResourceQuota,
      actions: {
        setItem: (item: V1ResourceQuota | null) => void;
        onDelete?: (item: V1ResourceQuota) => void;
        onEdit?: (item: V1ResourceQuota) => void;
      }
    ) => (
      <SidebarResourceQuotas
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
      renderSidebar={renderSidebar}
      yamlTemplate={templateResourceQuota}
      onCreate={onCreate}
      onUpdate={onUpdate}
      contextName={contextName}
      creating={creating}
      deleting={deleting}
    />
  );
}
