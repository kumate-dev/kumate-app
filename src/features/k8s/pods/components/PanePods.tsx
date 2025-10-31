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
import { useCallback, useMemo, useState } from 'react';
import { templatePod } from '../../templates/pod';
import { DotContainers } from './DotContainers';
import { getContainerStatuses } from '../utils/containerStatus';
import { WarningPod } from './WarningPod';
import { sortItems } from '@/utils/sort';

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
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const columns: ColumnDef<string>[] = [
    { label: 'Name', key: 'name', sortable: true },
    { label: '', key: 'warning', sortable: false },
    { label: 'Namespace', key: 'namespace', sortable: true },
    { label: 'Containers', key: 'containers', sortable: true },
    { label: 'CPU', key: 'cpu', sortable: true },
    { label: 'Memory', key: 'memory', sortable: true },
    { label: 'Restart', key: 'restart', sortable: true },
    { label: 'Controlled By', key: 'controlledBy', sortable: true },
    { label: 'Node', key: 'node', sortable: true },
    { label: 'QoS', key: 'qos', sortable: true },
    { label: 'Age', key: 'age', sortable: true },
    { label: 'Status', key: 'status', sortable: false },
  ];

  const sortedItems = useMemo(() => {
    const valueGetters = {
      name: (item: V1Pod) => item.metadata?.name || '',
      namespace: (item: V1Pod) => item.metadata?.namespace || '',
      containers: (item: V1Pod) => item.spec?.containers?.length || 0,
      cpu: (item: V1Pod) => {
        const cpuRequests = item.spec?.containers
          ?.map((c) => c.resources?.requests?.cpu)
          .filter(Boolean);
        return cpuRequests?.length || 0;
      },
      memory: (item: V1Pod) => {
        const memoryRequests = item.spec?.containers
          ?.map((c) => c.resources?.requests?.memory)
          .filter(Boolean);
        return memoryRequests?.length || 0;
      },
      restart: (item: V1Pod) => podRestartCount(item),
      controlledBy: (item: V1Pod) => item.metadata?.ownerReferences?.[0]?.name || '',
      node: (item: V1Pod) => item.spec?.nodeName || '',
      qos: (item: V1Pod) => item.status?.qosClass || '',
      age: (item: V1Pod) => new Date(item.metadata?.creationTimestamp || '').getTime(),
      status: (item: V1Pod) => getPodStatus(item),
      warning: (item: V1Pod) => {
        const containerStatuses = getContainerStatuses(item);
        return containerStatuses.some((status) => !status.ready) ? 1 : 0;
      },
    };

    return sortItems(items, sortBy, sortOrder, valueGetters);
  }, [items, sortBy, sortOrder]);

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
        contextName={contextName}
      />
    ),
    [contextName]
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
      emptyText="No pods found"
      onDelete={onDelete}
      onCreate={onCreate}
      onUpdate={onUpdate}
      yamlTemplate={templatePod}
      renderSidebar={renderSidebar}
      contextName={contextName}
      sortBy={sortBy}
      sortOrder={sortOrder}
      setSortBy={setSortBy}
      setSortOrder={setSortOrder}
    />
  );
}
