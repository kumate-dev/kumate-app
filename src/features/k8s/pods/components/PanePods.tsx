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
import { useOptimisticSortedItems } from '@/hooks/useOptimisticSortedItems';

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
  creating?: boolean;
  updating?: boolean;
  deleting?: boolean;
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
  creating = false,
  updating = false,
  deleting = false,
}: PanePodsProps) {
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const valueGetters = useMemo(
    () => ({
      name: (pod: V1Pod) => pod.metadata?.name || '',
      namespace: (pod: V1Pod) => pod.metadata?.namespace || '',
      containers: (pod: V1Pod) => pod.spec?.containers?.length || 0,
      restart: (pod: V1Pod) => podRestartCount(pod),
      qos: (pod: V1Pod) => pod.status?.qosClass || '',
      age: (pod: V1Pod) => new Date(pod.metadata?.creationTimestamp || '').getTime(),
      status: (pod: V1Pod) => getPodStatus(pod).status,
      warning: (pod: V1Pod) => {
        const containerStatuses = getContainerStatuses(pod);
        return containerStatuses.some((status) => !status.ready) ? 1 : 0;
      },
    }),
    []
  );

  const { sortedItems, onAfterCreate } = useOptimisticSortedItems<V1Pod>({
    items,
    sortBy,
    sortOrder,
    valueGetters,
    selectedNamespaces,
    isNamespaced: true,
  });

  const columns = useMemo(
    (): ColumnDef<string>[] => [
      { label: 'Name', key: 'name', sortable: true },
      { label: '', key: 'warning', sortable: false },
      { label: 'Namespace', key: 'namespace', sortable: true },
      { label: 'Containers', key: 'containers', sortable: true },
      { label: 'Restart', key: 'restart', sortable: true },
      { label: 'Age', key: 'age', sortable: true },
      { label: 'Status', key: 'status', sortable: false },
    ],
    []
  );

  // sortedItems provided by hook

  const renderRow = useCallback((pod: V1Pod) => {
    const containerStatuses = getContainerStatuses(pod);
    const hasWarning = containerStatuses.some(
      (status) => !status.ready && status.state?.terminated?.reason !== 'Completed'
    );
    const podName = pod.metadata?.name ?? '';
    const namespace = pod.metadata?.namespace ?? '';

    return (
      <>
        <Td className="max-w-truncate align-middle">
          <span className="block truncate" title={podName}>
            {podName}
          </span>
        </Td>
        <Td className="text-center align-middle">
          {hasWarning && (
            <WarningPod warnings={containerStatuses}>
              <div>
                <IconWarning />
              </div>
            </WarningPod>
          )}
        </Td>
        <Td>
          <BadgeNamespaces name={namespace} />
        </Td>
        <Td className="align-middle">
          <DotContainers containerStatuses={containerStatuses} />
        </Td>
        <Td>{podRestartCount(pod)}</Td>
        <AgeCell timestamp={pod.metadata?.creationTimestamp} />
        <Td>
          <BadgeStatus status={getPodStatus(pod)} />
        </Td>
      </>
    );
  }, []);

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
        updating={updating}
        deleting={deleting}
      />
    ),
    [contextName, updating, deleting]
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
      onAfterCreate={onAfterCreate}
      yamlTemplate={templatePod}
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
