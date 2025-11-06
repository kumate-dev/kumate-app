import { useMemo, useState, useCallback } from 'react';
import type { V1MutatingWebhookConfiguration } from '@kubernetes/client-node';
import { Td } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { PaneGeneric } from '../../generic/components/PaneGeneric';
import { ColumnDef } from '@/components/common/TableHeader';
import { sortItems } from '@/utils/sort';
import SidebarMutatingWebhooks from './SidebarMutatingWebhooks';
import { templateMutatingWebhook } from '../../templates/mutatingWebhook';

export interface PaneMutatingWebhooksProps {
  items: V1MutatingWebhookConfiguration[];
  loading: boolean;
  error: string;
  onDelete: (items: V1MutatingWebhookConfiguration[]) => Promise<void>;
  onCreate?: (
    manifest: V1MutatingWebhookConfiguration
  ) => Promise<V1MutatingWebhookConfiguration | undefined>;
  onUpdate?: (
    manifest: V1MutatingWebhookConfiguration
  ) => Promise<V1MutatingWebhookConfiguration | undefined>;
  contextName?: string;
  creating?: boolean;
  updating?: boolean;
  deleting?: boolean;
}

export default function PaneMutatingWebhooks({
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
}: PaneMutatingWebhooksProps) {
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const handleDeleteSelected = useCallback(
    async (toDelete: V1MutatingWebhookConfiguration[]) => {
      if (!toDelete.length) return;
      await onDelete(toDelete);
    },
    [onDelete]
  );

  const columns: ColumnDef<string>[] = [
    { label: 'Name', key: 'name', sortable: true },
    { label: 'Webhooks', key: 'count', sortable: true },
    { label: 'Age', key: 'age', sortable: true },
  ];

  const sortedItems = useMemo(() => {
    const valueGetters = {
      name: (item: V1MutatingWebhookConfiguration) => item.metadata?.name || '',
      count: (item: V1MutatingWebhookConfiguration) => item.webhooks?.length ?? 0,
      age: (item: V1MutatingWebhookConfiguration) =>
        new Date(item.metadata?.creationTimestamp || '').getTime(),
    };
    return sortItems(items, sortBy, sortOrder, valueGetters);
  }, [items, sortBy, sortOrder]);

  const renderRow = (mw: V1MutatingWebhookConfiguration) => (
    <>
      <Td className="max-w-truncate align-middle">
        <span className="block truncate" title={mw.metadata?.name ?? ''}>
          {mw.metadata?.name}
        </span>
      </Td>
      <Td>{mw.webhooks?.length ?? 0}</Td>
      <AgeCell timestamp={mw.metadata?.creationTimestamp ?? ''} />
    </>
  );

  const renderSidebar = (item: V1MutatingWebhookConfiguration, actions: any) => (
    <SidebarMutatingWebhooks
      item={item}
      setItem={actions.setItem}
      onDelete={actions.onDelete}
      onEdit={actions.onEdit}
      updating={updating}
      deleting={deleting}
    />
  );

  return (
    <PaneGeneric
      items={sortedItems}
      loading={loading}
      error={error}
      showNamespace={false}
      columns={columns}
      renderRow={renderRow}
      emptyText="No mutating webhooks found"
      onDelete={handleDeleteSelected}
      renderSidebar={renderSidebar}
      yamlTemplate={() => templateMutatingWebhook}
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
