import { useCallback, useMemo, useState } from 'react';
import { V1ReplicaSet, V1Namespace } from '@kubernetes/client-node';
import { Td } from '@/components/ui/table';
import { PaneGeneric } from '../../generic/components/PaneGeneric';
import { ColumnDef } from '../../../../components/common/TableHeader';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import AgeCell from '@/components/common/AgeCell';
import { BadgeStatus } from '../../generic/components/BadgeStatus';
import { getReplicaSetStatus } from '../utils/replicaSetStatus';
import { sortItems } from '@/utils/sort';
import { SidebarReplicaSets } from './SidebarReplicaSets';
import { templateReplicaSet } from '../../templates/replicaSet';
import { V1ReplicaSet as ReplicaSet } from '@kubernetes/client-node';

export interface PaneReplicaSetsProps {
  selectedNamespaces: string[];
  onSelectNamespace: (namespaces: string[]) => void;
  namespaceList: V1Namespace[];
  items: V1ReplicaSet[];
  loading: boolean;
  error: string;
  onDelete: (replicaSets: V1ReplicaSet[]) => Promise<void>;
  onCreate?: (manifest: ReplicaSet) => Promise<ReplicaSet | undefined>;
  onUpdate?: (manifest: ReplicaSet) => Promise<ReplicaSet | undefined>;
  contextName?: string;
  creating?: boolean;
  updating?: boolean;
  deleting?: boolean;
}

export default function PaneReplicaSets({
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
}: PaneReplicaSetsProps) {
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
      name: (item: V1ReplicaSet) => item.metadata?.name || '',
      namespace: (item: V1ReplicaSet) => item.metadata?.namespace || '',
      status: (item: V1ReplicaSet) => getReplicaSetStatus(item),
      age: (item: V1ReplicaSet) => new Date(item.metadata?.creationTimestamp || '').getTime(),
    };
    return sortItems(items, sortBy, sortOrder, valueGetters);
  }, [items, sortBy, sortOrder]);

  const renderRow = (rs: V1ReplicaSet) => {
    return (
      <>
        <Td className="max-w-truncate align-middle">
          <span className="block truncate" title={rs.metadata?.name}>
            {rs.metadata?.name}
          </span>
        </Td>
        <Td>
          <BadgeNamespaces name={rs.metadata?.namespace ?? ''} />
        </Td>
        <Td>
          <BadgeStatus status={getReplicaSetStatus(rs)} />
        </Td>
        <AgeCell timestamp={rs.metadata?.creationTimestamp ?? ''} />
      </>
    );
  };

  const renderSidebar = useCallback(
    (
      item: V1ReplicaSet,
      actions: {
        setItem: (item: V1ReplicaSet | null) => void;
        onDelete?: (item: V1ReplicaSet) => void;
        onEdit?: (item: V1ReplicaSet) => void;
      }
    ) => (
      <SidebarReplicaSets
        item={item}
        setItem={actions.setItem}
        onDelete={actions.onDelete}
        onEdit={undefined}
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
      emptyText="No replica sets found"
      onDelete={onDelete}
      renderSidebar={renderSidebar}
      yamlTemplate={templateReplicaSet}
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
