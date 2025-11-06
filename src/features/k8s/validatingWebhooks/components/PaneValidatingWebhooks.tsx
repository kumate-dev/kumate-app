import { useMemo, useState, useCallback } from 'react';
import type { V1ValidatingWebhookConfiguration } from '@kubernetes/client-node';
import { Td } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { PaneGeneric } from '../../generic/components/PaneGeneric';
import { ColumnDef } from '@/components/common/TableHeader';
import { sortItems } from '@/utils/sort';
import SidebarValidatingWebhooks from './SidebarValidatingWebhooks';
import { templateValidatingWebhook } from '../../templates/validatingWebhook';

export interface PaneValidatingWebhooksProps {
  items: V1ValidatingWebhookConfiguration[];
  loading: boolean;
  error: string;
  onDelete: (items: V1ValidatingWebhookConfiguration[]) => Promise<void>;
  onCreate?: (
    manifest: V1ValidatingWebhookConfiguration
  ) => Promise<V1ValidatingWebhookConfiguration | undefined>;
  onUpdate?: (
    manifest: V1ValidatingWebhookConfiguration
  ) => Promise<V1ValidatingWebhookConfiguration | undefined>;
  contextName?: string;
  creating?: boolean;
  updating?: boolean;
  deleting?: boolean;
}

export default function PaneValidatingWebhooks({
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
}: PaneValidatingWebhooksProps) {
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const handleDeleteSelected = useCallback(
    async (toDelete: V1ValidatingWebhookConfiguration[]) => {
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
      name: (item: V1ValidatingWebhookConfiguration) => item.metadata?.name || '',
      count: (item: V1ValidatingWebhookConfiguration) => item.webhooks?.length ?? 0,
      age: (item: V1ValidatingWebhookConfiguration) =>
        new Date(item.metadata?.creationTimestamp || '').getTime(),
    };
    return sortItems(items, sortBy, sortOrder, valueGetters);
  }, [items, sortBy, sortOrder]);

  const renderRow = (vw: V1ValidatingWebhookConfiguration) => (
    <>
      <Td className="max-w-truncate align-middle">
        <span className="block truncate" title={vw.metadata?.name ?? ''}>
          {vw.metadata?.name}
        </span>
      </Td>
      <Td>{vw.webhooks?.length ?? 0}</Td>
      <AgeCell timestamp={vw.metadata?.creationTimestamp ?? ''} />
    </>
  );

  const renderSidebar = (item: V1ValidatingWebhookConfiguration, actions: any) => (
    <SidebarValidatingWebhooks
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
      emptyText="No validating webhooks found"
      onDelete={handleDeleteSelected}
      renderSidebar={renderSidebar}
      yamlTemplate={() => templateValidatingWebhook}
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
