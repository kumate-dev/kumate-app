import { useCallback, useMemo, useState } from 'react';
import { V1StatefulSet, V1Namespace } from '@kubernetes/client-node';
import { Td } from '@/components/ui/table';
import { PaneGeneric } from '../../generic/components/PaneGeneric';
import { ColumnDef } from '../../../../components/common/TableHeader';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import AgeCell from '@/components/common/AgeCell';
import { BadgeStatus } from '../../generic/components/BadgeStatus';
import { getStatefulSetStatus } from '../utils/statefulSetStatus';
import { sortItems } from '@/utils/sort';
import { SidebarStatefulSets } from './SidebarStatefulSets';
import { templateStatefulSet } from '../../templates/statefulSet';
import { V1StatefulSet as StatefulSet } from '@kubernetes/client-node';

export interface PaneStatefulSetsProps {
  selectedNamespaces: string[];
  onSelectNamespace: (namespaces: string[]) => void;
  namespaceList: V1Namespace[];
  items: V1StatefulSet[];
  loading: boolean;
  error: string;
  onDeleteStatefulSets: (statefulSets: V1StatefulSet[]) => Promise<void>;
  onCreate?: (manifest: StatefulSet) => Promise<StatefulSet | undefined>;
  onUpdate?: (manifest: StatefulSet) => Promise<StatefulSet | undefined>;
  contextName?: string;
}

export default function PaneStatefulSets({
  selectedNamespaces,
  onSelectNamespace,
  namespaceList,
  items,
  loading,
  error,
  onDeleteStatefulSets,
  onCreate,
  onUpdate,
  contextName,
}: PaneStatefulSetsProps) {
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedItems, setSelectedItems] = useState<V1StatefulSet[]>([]);

  const handleDeleteSelected = useCallback(async () => {
    if (!selectedItems.length) return;
    await onDeleteStatefulSets(selectedItems);
    setSelectedItems([]);
  }, [selectedItems, onDeleteStatefulSets]);

  const columns: ColumnDef<string>[] = [
    { label: 'Name', key: 'name', sortable: true },
    { label: 'Namespace', key: 'namespace', sortable: true },
    { label: 'Ready', key: 'status', sortable: true },
    { label: 'Age', key: 'age', sortable: true },
  ];

  const sortedItems = useMemo(() => {
    const valueGetters = {
      name: (item: V1StatefulSet) => item.metadata?.name || '',
      namespace: (item: V1StatefulSet) => item.metadata?.namespace || '',
      status: (item: V1StatefulSet) => getStatefulSetStatus(item),
      age: (item: V1StatefulSet) => new Date(item.metadata?.creationTimestamp || '').getTime(),
    };
    return sortItems(items, sortBy, sortOrder, valueGetters);
  }, [items, sortBy, sortOrder]);

  const renderRow = (ss: V1StatefulSet) => {
    return (
      <>
        <Td className="max-w-truncate align-middle">
          <span className="block truncate" title={ss.metadata?.name}>
            {ss.metadata?.name}
          </span>
        </Td>
        <Td>
          <BadgeNamespaces name={ss.metadata?.namespace ?? ''} />
        </Td>
        <Td>
          <BadgeStatus status={getStatefulSetStatus(ss)} />
        </Td>
        <AgeCell timestamp={ss.metadata?.creationTimestamp ?? ''} />
      </>
    );
  };

  const renderSidebar = useCallback(
    (
      item: V1StatefulSet,
      actions: {
        setItem: (item: V1StatefulSet | null) => void;
        onDelete?: (item: V1StatefulSet) => void;
        onEdit?: (item: V1StatefulSet) => void;
      }
    ) => (
      <SidebarStatefulSets
        item={item}
        setItem={actions.setItem}
        onDelete={actions.onDelete}
        onEdit={actions.onEdit}
      />
    ),
    []
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
      emptyText="No stateful sets found"
      onDelete={handleDeleteSelected}
      renderSidebar={renderSidebar}
      yamlTemplate={templateStatefulSet}
      onCreate={onCreate}
      onUpdate={onUpdate}
      contextName={contextName}
      sortBy={sortBy}
      sortOrder={sortOrder}
      setSortBy={setSortBy}
      setSortOrder={setSortOrder}
    />
  );
}
