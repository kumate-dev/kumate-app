import { useCallback, useMemo, useState } from 'react';
import { V1IngressClass } from '@kubernetes/client-node';
import { PaneGeneric } from '../../generic/components/PaneGeneric';
import { ColumnDef } from '@/components/common/TableHeader';
import { Td } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { SidebarIngressClass } from './SidebarIngressClass';
import { templateIngressClass } from '../../templates/ingressClass';

export interface PaneIngressClassesProps {
  items: V1IngressClass[];
  loading: boolean;
  error: string;
  onDelete: (items: V1IngressClass[]) => Promise<void>;
  onCreate?: (manifest: V1IngressClass) => Promise<V1IngressClass | undefined>;
  onUpdate?: (manifest: V1IngressClass) => Promise<V1IngressClass | undefined>;
  contextName?: string;
  creating?: boolean;
  updating?: boolean;
  deleting?: boolean;
}

export function PaneIngressClasses({
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
}: PaneIngressClassesProps) {
  const [sortBy, setSortBy] = useState('Name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const columns: ColumnDef<string>[] = useMemo(
    () => [
      { key: 'Name', label: 'Name', sortable: true },
      { key: 'Controller', label: 'Controller', sortable: true },
      { key: 'Age', label: 'Age', sortable: true },
    ],
    []
  );

  const sortedItems = useMemo(() => {
    const copy = [...items];
    copy.sort((a, b) => {
      const av = (a.metadata?.name ?? '').localeCompare(b.metadata?.name ?? '');
      return sortOrder === 'asc' ? av : -av;
    });
    return copy;
  }, [items, sortOrder]);

  const renderRow = (ingc: V1IngressClass) => {
    const controller = ingc.spec?.controller ?? '-';
    return (
      <>
        <Td className="break-all text-white">{ingc.metadata?.name ?? '-'}</Td>
        <Td className="break-all text-white">{controller}</Td>
        <AgeCell timestamp={ingc.metadata?.creationTimestamp ?? ''} />
      </>
    );
  };

  const renderSidebar = useCallback(
    (
      item: V1IngressClass,
      actions: {
        setItem: (item: V1IngressClass | null) => void;
        onDelete?: (item: V1IngressClass) => void;
        onEdit?: (item: V1IngressClass) => void;
      }
    ) => (
      <SidebarIngressClass
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
      emptyText="No ingress classes found"
      onDelete={onDelete}
      renderSidebar={renderSidebar}
      yamlTemplate={templateIngressClass}
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

export default PaneIngressClasses;
