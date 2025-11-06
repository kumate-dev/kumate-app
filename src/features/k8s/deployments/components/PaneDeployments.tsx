import { V1Deployment, V1Namespace } from '@kubernetes/client-node';
import { Td } from '@/components/ui/table';
import { PaneGeneric } from '../../generic/components/PaneGeneric';
import { ColumnDef } from '@/components/common/TableHeader';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import AgeCell from '@/components/common/AgeCell';
import { getDeploymentStatus } from '../utils/deploymentStatus';
import { BadgeStatus } from '../../generic/components/BadgeStatus';
import { templateDeployment } from '../../templates/deployment';
import { useCallback, useMemo, useState } from 'react';
import { sortItems } from '@/utils/sort';
import { SidebarDeployments } from './SidebarDeployments';

export interface PaneDeploymentsProps {
  selectedNamespaces: string[];
  onSelectNamespace: (namespaces: string[]) => void;
  namespaceList: V1Namespace[];
  items: V1Deployment[];
  loading: boolean;
  error: string;
  onDelete: (deployments: V1Deployment[]) => Promise<void>;
  onCreate?: (manifest: V1Deployment) => Promise<V1Deployment | undefined>;
  onUpdate?: (manifest: V1Deployment) => Promise<V1Deployment | undefined>;
  contextName?: string;
  creating?: boolean;
  updating?: boolean;
  deleting?: boolean;
}

export default function PaneDeployments({
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
}: PaneDeploymentsProps) {
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const columns: ColumnDef<string>[] = [
    { label: 'Name', key: 'name', sortable: true },
    { label: 'Namespace', key: 'namespace', sortable: true },
    { label: 'Ready', key: 'status', sortable: true },
    { label: 'Age', key: 'age', sortable: true },
  ];

  const sortedItems = useMemo(() => {
    const valueGetters = {
      name: (item: V1Deployment) => item.metadata?.name || '',
      namespace: (item: V1Deployment) => item.metadata?.namespace || '',
      status: (item: V1Deployment) => getDeploymentStatus(item),
      age: (item: V1Deployment) => new Date(item.metadata?.creationTimestamp || '').getTime(),
    };

    return sortItems(items, sortBy, sortOrder, valueGetters);
  }, [items, sortBy, sortOrder]);

  const renderRow = (dep: V1Deployment) => (
    <>
      <Td className="max-w-truncate align-middle">
        <span className="block truncate" title={dep.metadata?.name ?? ''}>
          {dep.metadata?.name}
        </span>
      </Td>
      <Td>
        <BadgeNamespaces name={dep.metadata?.namespace ?? ''} />
      </Td>
      <Td>
        <BadgeStatus status={getDeploymentStatus(dep)} />
      </Td>
      <AgeCell timestamp={dep.metadata?.creationTimestamp} />
    </>
  );

  const renderSidebar = useCallback(
    (
      item: V1Deployment,
      actions: {
        setItem: (item: V1Deployment | null) => void;
        onDelete?: (item: V1Deployment) => void;
        onEdit?: (item: V1Deployment) => void;
      }
    ) => (
      <SidebarDeployments
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
      namespaceList={namespaceList}
      selectedNamespaces={selectedNamespaces}
      onSelectNamespace={onSelectNamespace}
      columns={columns}
      renderRow={renderRow}
      emptyText="No deployments found"
      onDelete={onDelete}
      onCreate={onCreate}
      onUpdate={onUpdate}
      yamlTemplate={templateDeployment}
      renderSidebar={renderSidebar}
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
