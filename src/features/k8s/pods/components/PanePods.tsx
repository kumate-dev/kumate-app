import { V1Namespace, V1Pod } from '@kubernetes/client-node';
import { Td } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { SidebarPods } from './SidebarPods';
import { PaneGeneric } from '../../generic/components/PaneGeneric';
import { ColumnDef } from '@/components/common/TableHeader';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import { podRestartCount } from '../utils/podRestartCount';
import { BadgeStatus } from '../../generic/components/BadgeStatus';
import { getPodStatus } from '../utils/podStatus';
import { IconWarning } from '@/components/common/IconWarning';
import { useCallback, RefObject } from 'react';
import { templatePod } from '../../templates/pod';
import { DotContainers } from './DotContainers';
import { getContainerStatuses } from '../utils/containerStatus';
import { WarningPod } from './WarningPod';

export interface PanePodsProps {
  selectedNamespaces: string[];
  onSelectNamespace: (namespaces: string[]) => void;
  namespaceList: V1Namespace[];
  items: V1Pod[];
  loading: boolean;
  error: string;
  onDelete: (pods: V1Pod[]) => Promise<void>;
  onCreate?: (manifest: V1Pod) => Promise<V1Pod | undefined>;
  onUpdate?: (manifest: V1Pod) => Promise<V1Pod | undefined>;
  contextName?: string;
}

export default function PanePods({
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
}: PanePodsProps) {
  const columns: ColumnDef<string>[] = [
    { label: 'Name', key: 'metadata' },
    { label: '', key: '', sortable: false },
    { label: 'Namespace', key: 'metadata' },
    { label: 'Containers', key: 'spec' },
    { label: 'CPU', key: 'spec' },
    { label: 'Memory', key: 'spec' },
    { label: 'Restart', key: 'status' },
    { label: 'Controlled By', key: 'metadata' },
    { label: 'Node', key: 'spec' },
    { label: 'QoS', key: 'status' },
    { label: 'Age', key: 'metadata' },
    { label: 'Status', key: 'status' },
  ];

  const renderRow = (pod: V1Pod) => {
    const containerStatuses = getContainerStatuses(pod);
    const hasWarning = containerStatuses.some((status) => !status.ready);
    return (
      <>
        <Td className="max-w-truncate align-middle">
          <span className="block truncate" title={pod.metadata?.name ?? ''}>
            {pod.metadata?.name}
          </span>
        </Td>
        <Td className="text-center align-middle">
          {hasWarning ? (
            <WarningPod warnings={containerStatuses}>
              <div>
                <IconWarning />
              </div>
            </WarningPod>
          ) : null}
        </Td>
        <Td>
          <BadgeNamespaces name={pod.metadata?.namespace ?? ''} />
        </Td>
        <Td className="align-middle">
          <DotContainers containerStatuses={getContainerStatuses(pod)} />
        </Td>
        <Td>{pod.spec?.containers?.map((c) => c.resources?.requests?.cpu).join(', ') || '-'}</Td>
        <Td>{pod.spec?.containers?.map((c) => c.resources?.requests?.memory).join(', ') || '-'}</Td>
        <Td>{podRestartCount(pod)}</Td>
        <Td>{pod.metadata?.ownerReferences?.map((o) => o.name).join(', ') || '-'}</Td>
        <Td>{pod.spec?.nodeName || '-'}</Td>
        <Td>{pod.status?.qosClass || '-'}</Td>
        <AgeCell timestamp={pod.metadata?.creationTimestamp} />
        <Td>
          <BadgeStatus status={getPodStatus(pod)} />
        </Td>
      </>
    );
  };

  const renderSidebar = useCallback(
    (
      item: V1Pod,
      actions: {
        setItem: (item: V1Pod | null) => void;
        onDelete?: (item: V1Pod) => void;
        onEdit?: (item: V1Pod) => void;
      }
    ) => (
      <SidebarPods
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
      emptyText="No pods found"
      onDelete={onDelete}
      onCreate={onCreate}
      onUpdate={onUpdate}
      yamlTemplate={templatePod}
      renderSidebar={renderSidebar}
      contextName={contextName}
    />
  );
}
