import { useMemo, useState, useCallback } from 'react';
import type { V1RuntimeClass } from '@kubernetes/client-node';
import { Td } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { PaneGeneric } from '../../generic/components/PaneGeneric';
import { ColumnDef } from '@/components/common/TableHeader';
import { sortItems } from '@/utils/sort';
import { templateRuntimeClass } from '../../templates/runtimeClass';
import { SidebarRuntimeClasses } from './SidebarRuntimeClasses';

export interface PaneRuntimeClassesProps {
  items: V1RuntimeClass[];
  loading: boolean;
  error: string;
  onDelete: (items: V1RuntimeClass[]) => Promise<void>;
  onCreate?: (manifest: V1RuntimeClass) => Promise<V1RuntimeClass | undefined>;
  onUpdate?: (manifest: V1RuntimeClass) => Promise<V1RuntimeClass | undefined>;
  contextName?: string;
  creating?: boolean;
  updating?: boolean;
  deleting?: boolean;
}

export default function PaneRuntimeClasses({
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
}: PaneRuntimeClassesProps) {
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const columns: ColumnDef<string>[] = [
    { label: 'Name', key: 'name', sortable: true },
    { label: 'Handler', key: 'handler', sortable: true },
    { label: 'Scheduling', key: 'scheduling', sortable: false },
    { label: 'Overhead', key: 'overhead', sortable: false },
    { label: 'Age', key: 'age', sortable: true },
  ];

  const sortedItems = useMemo(() => {
    const valueGetters = {
      name: (item: V1RuntimeClass) => item.metadata?.name || '',
      handler: (item: V1RuntimeClass) => item.handler || '',
      scheduling: (item: V1RuntimeClass) =>
        Object.keys(item.scheduling?.nodeSelector || {}).length || 0,
      overhead: (item: V1RuntimeClass) =>
        Object.keys((item.overhead as any)?.podFixed || {}).length || 0,
      age: (item: V1RuntimeClass) => new Date(item.metadata?.creationTimestamp || '').getTime(),
    };
    return sortItems(items, sortBy, sortOrder, valueGetters);
  }, [items, sortBy, sortOrder]);

  const renderRow = (rc: V1RuntimeClass) => (
    <>
      <Td className="max-w-truncate align-middle">
        <span className="block truncate" title={rc.metadata?.name ?? ''}>
          {rc.metadata?.name}
        </span>
      </Td>
      <Td>{rc.handler ?? '-'}</Td>
      <Td>
        {Object.keys(rc.scheduling?.nodeSelector || {}).length
          ? Object.entries(rc.scheduling!.nodeSelector!)
              .map(([k, v]) => `${k}=${v}`)
              .join(', ')
          : '-'}
      </Td>
      <Td>
        {Object.keys((rc.overhead as any)?.podFixed || {}).length
          ? Object.entries(((rc.overhead as any).podFixed as Record<string, any>) || {})
              .map(([k, v]) => `${k}: ${String(v)}`)
              .join(', ')
          : '-'}
      </Td>
      <AgeCell timestamp={rc.metadata?.creationTimestamp ?? ''} />
    </>
  );

  const renderSidebar = useCallback(
    (
      item: V1RuntimeClass,
      actions: {
        setItem: (item: V1RuntimeClass | null) => void;
        onDelete?: (item: V1RuntimeClass) => void;
        onEdit?: (item: V1RuntimeClass) => void;
      }
    ) => (
      <SidebarRuntimeClasses
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
      yamlTemplate={() => templateRuntimeClass()}
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
