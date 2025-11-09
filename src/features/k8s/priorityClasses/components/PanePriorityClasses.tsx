import { useMemo, useState, useCallback } from 'react';
import type { V1PriorityClass } from '@kubernetes/client-node';
import { Td } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { PaneGeneric } from '../../generic/components/PaneGeneric';
import { ColumnDef } from '@/components/common/TableHeader';
import { sortItems } from '@/utils/sort';
import { SidebarPriorityClasses } from './SidebarPriorityClasses';
import { templatePriorityClass } from '../../templates/priorityClass';

export interface PanePriorityClassesProps {
  items: V1PriorityClass[];
  loading: boolean;
  error: string;
  onDelete: (items: V1PriorityClass[]) => Promise<void>;
  onCreate?: (manifest: V1PriorityClass) => Promise<V1PriorityClass | undefined>;
  onUpdate?: (manifest: V1PriorityClass) => Promise<V1PriorityClass | undefined>;
  contextName?: string;
  creating?: boolean;
  updating?: boolean;
  deleting?: boolean;
}

export default function PanePriorityClasses({
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
}: PanePriorityClassesProps) {
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const columns: ColumnDef<string>[] = [
    { label: 'Name', key: 'name', sortable: true },
    { label: 'Value', key: 'value', sortable: true },
    { label: 'Global Default', key: 'globalDefault', sortable: true },
    { label: 'Age', key: 'age', sortable: true },
  ];

  const sortedItems = useMemo(() => {
    const valueGetters = {
      name: (item: V1PriorityClass) => item.metadata?.name || '',
      value: (item: V1PriorityClass) => item.value ?? 0,
      globalDefault: (item: V1PriorityClass) => (item.globalDefault ? 'Yes' : 'No'),
      age: (item: V1PriorityClass) => new Date(item.metadata?.creationTimestamp || '').getTime(),
    };
    return sortItems(items, sortBy, sortOrder, valueGetters);
  }, [items, sortBy, sortOrder]);

  const renderRow = (pc: V1PriorityClass) => (
    <>
      <Td className="max-w-truncate align-middle">
        <span className="block truncate" title={pc.metadata?.name ?? ''}>
          {pc.metadata?.name}
        </span>
      </Td>
      <Td>{pc.value ?? '-'}</Td>
      <Td>{pc.globalDefault ? 'Yes' : 'No'}</Td>
      <AgeCell timestamp={pc.metadata?.creationTimestamp ?? ''} />
    </>
  );

  const renderSidebar = useCallback(
    (
      item: V1PriorityClass,
      actions: {
        setItem: (item: V1PriorityClass | null) => void;
        onDelete?: (item: V1PriorityClass) => void;
        onEdit?: (item: V1PriorityClass) => void;
      }
    ) => (
      <SidebarPriorityClasses
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
      showNamespace={false}
      columns={columns}
      renderRow={renderRow}
      onDelete={onDelete}
      renderSidebar={renderSidebar}
      yamlTemplate={() => templatePriorityClass()}
      onCreate={onCreate}
      onUpdate={onUpdate}
      sortBy={sortBy}
      sortOrder={sortOrder}
      setSortBy={setSortBy}
      setSortOrder={setSortOrder}
      contextName={contextName}
      creating={creating}
      deleting={deleting}
    />
  );
}
