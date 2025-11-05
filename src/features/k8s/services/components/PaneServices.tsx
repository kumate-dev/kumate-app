import { useState, useCallback, useMemo } from 'react';
import { V1Service, V1Namespace } from '@kubernetes/client-node';
import { Td } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import { PaneGeneric } from '../../generic/components/PaneGeneric';
import { SidebarServices } from './SidebarServices';
import { ColumnDef } from '../../../../components/common/TableHeader';
import { sortItems } from '@/utils/sort';
import { templateService } from '../../templates/service';

export interface PaneServicesProps {
  selectedNamespaces: string[];
  onSelectNamespace: (namespaces: string[]) => void;
  namespaceList: V1Namespace[];
  items: V1Service[];
  loading: boolean;
  error: string;
  onDeleteServices: (services: V1Service[]) => Promise<void>;
  onCreate?: (manifest: V1Service) => Promise<V1Service | undefined>;
  onUpdate?: (manifest: V1Service) => Promise<V1Service | undefined>;
  contextName?: string;
}

export default function PaneServices({
  selectedNamespaces,
  onSelectNamespace,
  namespaceList,
  items,
  loading,
  error,
  onDeleteServices,
  onCreate,
  onUpdate,
  contextName,
}: PaneServicesProps) {
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const handleDeleteSelected = useCallback(async (toDelete: V1Service[]) => {
    if (!toDelete.length) return;
    await onDeleteServices(toDelete);
  }, [onDeleteServices]);

  const columns: ColumnDef<string>[] = [
    { label: 'Name', key: 'name', sortable: true },
    { label: 'Namespace', key: 'namespace', sortable: true },
    { label: 'Type', key: 'type', sortable: true },
    { label: 'Cluster IP', key: 'clusterIP', sortable: true },
    { label: 'Ports', key: 'ports', sortable: false },
    { label: 'Age', key: 'age', sortable: true },
  ];

  const sortedItems = useMemo(() => {
    const valueGetters = {
      name: (item: V1Service) => item.metadata?.name || '',
      namespace: (item: V1Service) => item.metadata?.namespace || '',
      type: (item: V1Service) => item.spec?.type || '',
      clusterIP: (item: V1Service) => item.spec?.clusterIP || item.spec?.clusterIPs?.[0] || '',
      ports: (item: V1Service) => (item.spec?.ports || []).map((p) => p.port).join(', '),
      age: (item: V1Service) => new Date(item.metadata?.creationTimestamp || '').getTime(),
    };
    return sortItems(items, sortBy, sortOrder, valueGetters);
  }, [items, sortBy, sortOrder]);

  const renderRow = (svc: V1Service) => (
    <>
      <Td className="max-w-truncate align-middle">
        <span className="block truncate" title={svc.metadata?.name ?? ''}>
          {svc.metadata?.name}
        </span>
      </Td>
      <Td>
        <BadgeNamespaces name={svc.metadata?.namespace ?? ''} />
      </Td>
      <Td>{svc.spec?.type ?? '-'}</Td>
      <Td>{svc.spec?.clusterIP || svc.spec?.clusterIPs?.[0] || '-'}</Td>
      <Td className="max-w-truncate align-middle">
        <span className="block truncate" title={(svc.spec?.ports || []).map((p) => String(p.port)).join(', ')}>
          {(svc.spec?.ports || []).map((p) => String(p.port)).join(', ') || '-'}
        </span>
      </Td>
      <AgeCell timestamp={svc.metadata?.creationTimestamp ?? ''} />
    </>
  );

  const renderSidebar = useCallback(
    (
      item: V1Service,
      actions: {
        setItem: (item: V1Service | null) => void;
        onDelete?: (item: V1Service) => void;
        onEdit?: (item: V1Service) => void;
      }
    ) => (
      <SidebarServices
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
      sortBy={sortBy}
      sortOrder={sortOrder}
      setSortBy={setSortBy}
      setSortOrder={setSortOrder}
      onDelete={handleDeleteSelected}
      renderRow={renderRow}
      yamlTemplate={templateService}
      onCreate={onCreate}
      onUpdate={onUpdate}
      renderSidebar={renderSidebar}
      contextName={contextName}
    />
  );
}