import { useMemo, useState } from 'react';
import type { V1ValidatingWebhookConfiguration } from '@kubernetes/client-node';
import { Td } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { PaneGeneric } from '../../generic/components/PaneGeneric';
import { ColumnDef } from '@/components/common/TableHeader';
import { useOptimisticSortedItems } from '@/hooks/useOptimisticSortedItems';
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
  const valueGetters = useMemo(
    () => ({
      name: (item: V1ValidatingWebhookConfiguration) => item.metadata?.name || '',
      count: (item: V1ValidatingWebhookConfiguration) => item.webhooks?.length ?? 0,
      age: (item: V1ValidatingWebhookConfiguration) =>
        new Date(item.metadata?.creationTimestamp || '').getTime(),
    }),
    []
  );

  const { sortedItems, onAfterCreate } = useOptimisticSortedItems<V1ValidatingWebhookConfiguration>(
    {
      items,
      sortBy,
      sortOrder,
      valueGetters,
      isNamespaced: false,
    }
  );

  const columns: ColumnDef<string>[] = [
    { label: 'Name', key: 'name', sortable: true },
    { label: 'Webhooks', key: 'count', sortable: true },
    { label: 'Age', key: 'age', sortable: true },
  ];

  // sortedItems provided by hook

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
      onDelete={onDelete}
      renderSidebar={renderSidebar}
      yamlTemplate={() => templateValidatingWebhook}
      onCreate={onCreate}
      onUpdate={onUpdate}
      onAfterCreate={onAfterCreate}
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
