import { useCallback, useMemo, useState } from 'react';
import { V1ReplicationController, V1Namespace } from '@kubernetes/client-node';
import { Td } from '@/components/ui/table';
import { PaneGeneric } from '../../generic/components/PaneGeneric';
import { ColumnDef } from '../../../../components/common/TableHeader';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import AgeCell from '@/components/common/AgeCell';
import { getReplicationControllerStatus } from '../utils/replicationControllerStatus';
import { BadgeStatus } from '../../generic/components/BadgeStatus';
import { sortItems } from '@/utils/sort';
import { SidebarReplicationControllers } from './SidebarReplicationControllers';
import { templateReplicationController } from '../../templates/replicationController';
import { V1ReplicationController as ReplicationController } from '@kubernetes/client-node';

export interface PaneReplicationControllersProps {
  selectedNamespaces: string[];
  onSelectNamespace: (namespaces: string[]) => void;
  namespaceList: V1Namespace[];
  items: V1ReplicationController[];
  loading: boolean;
  error: string;
  onDelete: (replicationControllers: V1ReplicationController[]) => Promise<void>;
  onCreate?: (manifest: ReplicationController) => Promise<ReplicationController | undefined>;
  onUpdate?: (manifest: ReplicationController) => Promise<ReplicationController | undefined>;
  contextName?: string;
  creating?: boolean;
  updating?: boolean;
  deleting?: boolean;
}

export default function PaneReplicationControllers({
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
}: PaneReplicationControllersProps) {
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const columns: ColumnDef<string>[] = [
    { label: 'Name', key: 'name', sortable: true },
    { label: 'Namespace', key: 'namespace', sortable: true },
    { label: 'Ready', key: 'status', sortable: true },
    { label: 'Age', key: 'age', sortable: true },
  ];

  const sortedItems = useMemo(() => {
    const valueGetters = {
      name: (item: V1ReplicationController) => item.metadata?.name || '',
      namespace: (item: V1ReplicationController) => item.metadata?.namespace || '',
      status: (item: V1ReplicationController) => getReplicationControllerStatus(item),
      age: (item: V1ReplicationController) =>
        new Date(item.metadata?.creationTimestamp || '').getTime(),
    };
    return sortItems(items, sortBy, sortOrder, valueGetters);
  }, [items, sortBy, sortOrder]);

  const renderRow = (rc: V1ReplicationController) => {
    return (
      <>
        <Td className="max-w-truncate align-middle">
          <span className="block truncate" title={rc.metadata?.name}>
            {rc.metadata?.name}
          </span>
        </Td>
        <Td>
          <BadgeNamespaces name={rc.metadata?.namespace ?? ''} />
        </Td>
        <Td>
          <BadgeStatus status={getReplicationControllerStatus(rc)} />
        </Td>
        <AgeCell timestamp={rc.metadata?.creationTimestamp ?? ''} />
      </>
    );
  };

  const renderSidebar = useCallback(
    (
      item: V1ReplicationController,
      actions: {
        setItem: (item: V1ReplicationController | null) => void;
        onDelete?: (item: V1ReplicationController) => void;
        onEdit?: (item: V1ReplicationController) => void;
      }
    ) => (
      <SidebarReplicationControllers
        item={item}
        setItem={actions.setItem}
        onDelete={actions.onDelete}
        onEdit={actions.onEdit}
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
      renderRow={renderRow}
      emptyText="No replication controllers found"
      onDelete={onDelete}
      renderSidebar={renderSidebar}
      yamlTemplate={templateReplicationController}
      onCreate={onCreate}
      onUpdate={onUpdate}
      contextName={contextName}
      sortBy={sortBy}
      sortOrder={sortOrder}
      setSortBy={setSortBy}
      setSortOrder={setSortOrder}
      creating={creating}
      deleting={deleting}
    />
  );
}
