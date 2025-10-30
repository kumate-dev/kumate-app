import { useState, useCallback, RefObject } from 'react';
import { V1Namespace, V1Pod } from '@kubernetes/client-node';
import { Td } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { SidebarK8sPods } from './SidebarPods';
import { PaneResource } from '../../generic/components/PaneGeneric';
import { ColumnDef, TableHeader } from '@/components/common/TableHeader';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import { podHasPodWarning } from '../utils/podHasWarning';
import { podDots } from '../utils/podDots';
import { podRestartCount } from '../utils/podRestartCount';
import { BadgeStatus } from '../../generic/components/BadgeStatus';
import { getPodStatus } from '../utils/podStatus';
import { Warning } from '@/components/common/Warning';

export interface PanePodsProps {
  selectedNamespaces: string[];
  onSelectNamespace: (namespaces: string[]) => void;
  namespaceList: V1Namespace[];
  items: V1Pod[];
  loading: boolean;
  error: string;
  onDeletePods: (pods: V1Pod[]) => Promise<void>;
  onCreatePod?: (pod: V1Pod) => Promise<void>;
}

export default function PanePods({
  selectedNamespaces,
  onSelectNamespace,
  namespaceList,
  items,
  loading,
  error,
  onDeletePods,
  onCreatePod,
}: PanePodsProps) {
  const [q, setQ] = useState('');
  const [sortBy, setSortBy] = useState<keyof V1Pod>('metadata');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedPods, setSelectedPods] = useState<V1Pod[]>([]);
  const [selectedPod, setSelectedPod] = useState<V1Pod | null>(null);

  const togglePod = useCallback((pod: V1Pod) => {
    setSelectedPods((prev) =>
      prev.includes(pod) ? prev.filter((p) => p !== pod) : [...prev, pod]
    );
  }, []);

  const toggleAllPods = useCallback(
    (checked: boolean) => {
      setSelectedPods(checked ? [...items] : []);
    },
    [items]
  );

  const handleDeleteSelected = useCallback(async () => {
    if (selectedPods.length === 0) return;
    await onDeletePods(selectedPods);
    setSelectedPods([]);
    setSelectedPod(null);
  }, [selectedPods, onDeletePods]);

  const handleDeleteOne = async (item: V1Pod) => {
    await onDeletePods([item]);
    setSelectedPod(null);
  };

  const handleCreate = async () => {
    if (!onCreatePod) return;

    const defaultPodManifest: V1Pod = {
      metadata: {
        name: `pod-${Date.now()}`,
        namespace: selectedNamespaces[0] !== 'all' ? selectedNamespaces[0] : 'default',
      },
      spec: {
        containers: [
          {
            name: 'nginx',
            image: 'nginx:latest',
            ports: [{ containerPort: 80 }],
          },
        ],
      },
    };

    await onCreatePod(defaultPodManifest);
  };

  const columns: ColumnDef<keyof V1Pod | ''>[] = [
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

  const tableHeader = (
    <TableHeader
      columns={columns}
      sortBy={sortBy}
      sortOrder={sortOrder}
      setSortBy={setSortBy}
      setSortOrder={setSortOrder}
      onToggleAll={toggleAllPods}
      selectedItems={selectedPods}
      totalItems={items}
    />
  );

  const renderRow = (pod: V1Pod) => (
    <>
      <Td className="max-w-truncate align-middle">
        <span className="block truncate" title={pod.metadata?.name ?? ''}>
          {pod.metadata?.name}
        </span>
      </Td>
      <Td className="text-center align-middle">{podHasPodWarning(pod) && <Warning />}</Td>
      <Td>
        <BadgeNamespaces name={pod.metadata?.namespace ?? ''} />
      </Td>
      <Td className="align-middle">
        <div className="inline-flex items-center gap-1">
          {pod.status?.containerStatuses?.length
            ? pod.status.containerStatuses.map((st, idx) => (
                <span
                  key={idx}
                  className={`h-2.5 w-2.5 rounded-full ${podDots(
                    st.state?.waiting?.reason || st.state?.terminated?.reason
                  )}`}
                />
              ))
            : Array.from({ length: pod.spec?.containers?.length || 0 }).map((_, idx) => (
                <span key={idx} className="h-2.5 w-2.5 rounded-full bg-white/30" />
              ))}
        </div>
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

  const renderSidebar = (item: V1Pod, tableRef: RefObject<HTMLTableElement | null>) => (
    <SidebarK8sPods
      item={item}
      setItem={setSelectedPod}
      onDelete={handleDeleteOne}
      tableRef={tableRef}
    />
  );

  return (
    <PaneResource
      items={items}
      loading={loading}
      error={error}
      query={q}
      onQueryChange={setQ}
      namespaceList={namespaceList}
      selectedNamespaces={selectedNamespaces}
      onSelectNamespace={onSelectNamespace}
      selectedItems={selectedPods}
      onToggleItem={togglePod}
      onToggleAll={toggleAllPods}
      onDeleteSelected={handleDeleteSelected}
      onCreate={onCreatePod ? handleCreate : undefined}
      colSpan={columns.length + 1}
      tableHeader={tableHeader}
      renderRow={renderRow}
      onRowClick={setSelectedPod}
      selectedItem={selectedPod}
      renderSidebar={renderSidebar}
    />
  );
}
