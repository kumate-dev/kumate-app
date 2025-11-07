import { useCallback, useMemo, useState } from 'react';
import { V1Endpoints, V1Namespace } from '@kubernetes/client-node';
import { PaneGeneric } from '../../generic/components/PaneGeneric';
import { ColumnDef } from '@/components/common/TableHeader';
import { Td } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import { SidebarEndpoints } from './SidebarEndpoints';
import { templateEndpoint } from '../../templates/endpoint';

export interface PaneEndpointsProps {
  selectedNamespaces: string[];
  onSelectNamespace: (namespaces: string[]) => void;
  namespaceList: V1Namespace[];
  items: V1Endpoints[];
  loading: boolean;
  error: string;
  onDelete: (eps: V1Endpoints[]) => Promise<void>;
  onCreate?: (manifest: V1Endpoints) => Promise<V1Endpoints | undefined>;
  onUpdate?: (manifest: V1Endpoints) => Promise<V1Endpoints | undefined>;
  contextName?: string;
  creating?: boolean;
  updating?: boolean;
  deleting?: boolean;
}

export function PaneEndpoints({
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
}: PaneEndpointsProps) {
  const [sortBy, setSortBy] = useState('Name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const columns: ColumnDef<string>[] = useMemo(
    () => [
      { key: 'Name', label: 'Name', sortable: true },
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

  const renderRow = (ep: V1Endpoints) => (
    <>
      <Td className="break-all text-white">{ep.metadata?.name ?? '-'}</Td>
      <Td>
        <BadgeNamespaces name={ep.metadata?.namespace ?? ''} />
      </Td>
      <AgeCell timestamp={ep.metadata?.creationTimestamp ?? ''} />
    </>
  );

  const renderSidebar = useCallback(
    (
      item: V1Endpoints,
      actions: {
        setItem: (item: V1Endpoints | null) => void;
        onDelete?: (item: V1Endpoints) => void;
        onEdit?: (item: V1Endpoints) => void;
      }
    ) => (
      <SidebarEndpoints
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
      emptyText="No endpoints found"
      onDelete={onDelete}
      renderSidebar={renderSidebar}
      yamlTemplate={templateEndpoint}
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

export default PaneEndpoints;
