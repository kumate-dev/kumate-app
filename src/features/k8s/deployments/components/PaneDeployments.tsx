import { V1Deployment, V1Namespace } from '@kubernetes/client-node';
import { Td } from '@/components/ui/table';
import { SidebarK8sDeployments } from './SidebarDeployments';
import { PaneGeneric } from '../../generic/components/PaneGeneric';
import { ColumnDef } from '@/components/common/TableHeader';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import AgeCell from '@/components/common/AgeCell';
import { getDeploymentStatus } from '../utils/deploymentStatus';
import { BadgeStatus } from '../../generic/components/BadgeStatus';
import { templateDeployment } from '../../templates/deployment';
import { useCallback, RefObject } from 'react';

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
}: PaneDeploymentsProps) {
  const columns: ColumnDef<string>[] = [
    { label: 'Name', key: 'metadata' },
    { label: 'Namespace', key: 'metadata' },
    { label: 'Ready', key: 'status' },
    { label: 'Age', key: 'metadata' },
  ];

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
      <SidebarK8sDeployments
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
      items={items}
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
    />
  );
}
