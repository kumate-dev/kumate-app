import { useCallback, useMemo, useState } from 'react';
import { V1DaemonSet, V1Namespace } from '@kubernetes/client-node';
import { PaneGeneric } from '../../generic/components/PaneGeneric';
import { ColumnDef } from '../../../../components/common/TableHeader';
import { Td } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import { BadgeStatus } from '../../generic/components/BadgeStatus';
import { getDaemonSetStatus } from '../utils/daemonSetStatus';
import { sortItems } from '@/utils/sort';
import { SidebarDaemonSets } from './SidebarDaemonSets';
import { templateDaemonSet } from '../../templates/daemonSet';
import { V1DaemonSet as DaemonSet } from '@kubernetes/client-node';

export interface PaneDaemonSetsProps {
  selectedNamespaces: string[];
  onSelectNamespace: (namespaces: string[]) => void;
  namespaceList: V1Namespace[];
  items: V1DaemonSet[];
  loading: boolean;
  error: string;
  onDelete: (daemonSets: V1DaemonSet[]) => Promise<void>;
  onCreate?: (manifest: DaemonSet) => Promise<DaemonSet | undefined>;
  onUpdate?: (manifest: DaemonSet) => Promise<DaemonSet | undefined>;
  contextName?: string;
  creating?: boolean;
  updating?: boolean;
  deleting?: boolean;
}

export default function PaneDaemonSets({
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
}: PaneDaemonSetsProps) {
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedItems, setSelectedItems] = useState<V1DaemonSet[]>([]);

  const handleDeleteSelected = useCallback(async () => {
    if (selectedItems.length === 0) return;
    await onDelete(selectedItems);
    setSelectedItems([]);
  }, [selectedItems, onDelete]);

  const columns: ColumnDef<string>[] = [
    { label: 'Name', key: 'name', sortable: true },
    { label: 'Namespace', key: 'namespace', sortable: true },
    { label: 'Ready', key: 'status', sortable: true },
    { label: 'Age', key: 'age', sortable: true },
  ];

  const sortedItems = useMemo(() => {
    const valueGetters = {
      name: (item: V1DaemonSet) => item.metadata?.name || '',
      namespace: (item: V1DaemonSet) => item.metadata?.namespace || '',
      status: (item: V1DaemonSet) => getDaemonSetStatus(item),
      age: (item: V1DaemonSet) => new Date(item.metadata?.creationTimestamp || '').getTime(),
    };
    return sortItems(items, sortBy, sortOrder, valueGetters);
  }, [items, sortBy, sortOrder]);

  const renderRow = (ds: V1DaemonSet) => (
    <>
      <Td className="max-w-truncate align-middle">
        <span className="block truncate" title={ds.metadata?.name}>
          {ds.metadata?.name}
        </span>
      </Td>
      <Td>
        <BadgeNamespaces name={ds.metadata?.namespace ?? ''} />
      </Td>
      <Td>
        <BadgeStatus status={getDaemonSetStatus(ds)} />
      </Td>
      <AgeCell timestamp={ds.metadata?.creationTimestamp ?? ''} />
    </>
  );

  const renderSidebar = useCallback(
    (
      item: V1DaemonSet,
      actions: {
        setItem: (item: V1DaemonSet | null) => void;
        onDelete?: (item: V1DaemonSet) => void;
        onEdit?: (item: V1DaemonSet) => void;
      }
    ) => (
      <SidebarDaemonSets
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
      emptyText="No daemon sets found"
      onDelete={handleDeleteSelected}
      renderSidebar={renderSidebar}
      sortBy={sortBy}
      sortOrder={sortOrder}
      setSortBy={setSortBy}
      setSortOrder={setSortOrder}
      yamlTemplate={templateDaemonSet}
      onCreate={onCreate}
      onUpdate={onUpdate}
      contextName={contextName}
      creating={creating}
      deleting={deleting}
    />
  );
}
