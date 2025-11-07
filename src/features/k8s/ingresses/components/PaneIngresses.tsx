import { useCallback, useMemo, useState } from 'react';
import { V1Ingress, V1Namespace } from '@kubernetes/client-node';
import { PaneGeneric } from '../../generic/components/PaneGeneric';
import { ColumnDef } from '@/components/common/TableHeader';
import { Td } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import { SidebarIngresses } from './SidebarIngresses';
import { templateIngress } from '../../templates/ingress';

export interface PaneIngressesProps {
  selectedNamespaces: string[];
  onSelectNamespace: (namespaces: string[]) => void;
  namespaceList: V1Namespace[];
  items: V1Ingress[];
  loading: boolean;
  error: string;
  onDelete: (items: V1Ingress[]) => Promise<void>;
  onCreate?: (manifest: V1Ingress) => Promise<V1Ingress | undefined>;
  onUpdate?: (manifest: V1Ingress) => Promise<V1Ingress | undefined>;
  contextName?: string;
  creating?: boolean;
  updating?: boolean;
  deleting?: boolean;
}

export function PaneIngresses({
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
}: PaneIngressesProps) {
  const [sortBy, setSortBy] = useState('Name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const columns: ColumnDef<string>[] = useMemo(
    () => [
      { key: 'Name', label: 'Name', sortable: true },
      { key: 'Class', label: 'Class', sortable: true },
      { key: 'Hosts', label: 'Hosts', sortable: false },
      { key: 'Namespace', label: 'Namespace', sortable: true },
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

  const renderRow = (ing: V1Ingress) => {
    const hosts = (ing.spec?.rules || [])
      .map((r) => r.host || '')
      .filter(Boolean)
      .join(', ');
    return (
      <>
        <Td className="break-all text-white">{ing.metadata?.name ?? '-'}</Td>
        <Td className="break-all text-white">{ing.spec?.ingressClassName ?? '-'}</Td>
        <Td className="break-all text-white">{hosts || '-'}</Td>
        <Td>
          <BadgeNamespaces name={ing.metadata?.namespace ?? ''} />
        </Td>
        <AgeCell timestamp={ing.metadata?.creationTimestamp ?? ''} />
      </>
    );
  };

  const renderSidebar = useCallback(
    (
      item: V1Ingress,
      actions: {
        setItem: (item: V1Ingress | null) => void;
        onDelete?: (item: V1Ingress) => void;
        onEdit?: (item: V1Ingress) => void;
      }
    ) => (
      <SidebarIngresses
        item={item}
        setItem={actions.setItem}
        onDelete={actions.onDelete}
        onEdit={actions.onEdit}
        updating={updating}
        deleting={deleting}
      />
    ),
    [updating, deleting]
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
      emptyText="No ingresses found"
      onDelete={onDelete}
      renderSidebar={renderSidebar}
      yamlTemplate={templateIngress}
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

export default PaneIngresses;
