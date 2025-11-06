import type { V1Pod } from '@kubernetes/client-node';
import { Table, Tbody, Td, Tr } from '@/components/ui/table';
import { RightSidebarGeneric } from '../../generic/components/RightSidebarGeneric';
import AgeCell from '@/components/common/AgeCell';
import { TableYamlRow } from '@/components/common/TableYamlRow';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import { BadgeStatus } from '../../generic/components/BadgeStatus';
import { getPodStatus } from '../utils/podStatus';
import { getContainerStatuses } from '../utils/containerStatus';
import { ButtonLog } from '@/components/common/ButtonLog';
import BottomExecTerminal from '@/components/common/BottomExecTerminal';
import { useState, useCallback, useMemo } from 'react';
import BottomLogViewer from '@/components/common/BottomLogViewer';
import { ButtonShell } from '@/components/common/ButtonShell';

interface SidebarPodsProps {
  item: V1Pod | null;
  setItem: (item: V1Pod | null) => void;
  onDelete?: (item: V1Pod) => void;
  onEdit?: (item: V1Pod) => void;
  contextName?: string;
  updating?: boolean;
  deleting?: boolean;
}

export function SidebarPods({
  item,
  setItem,
  onDelete,
  onEdit,
  contextName,
  updating = false,
  deleting = false,
}: SidebarPodsProps) {
  const containerStatuses = useMemo(() => (item ? getContainerStatuses(item) : []), [item]);

  const [logViewerOpen, setLogViewerOpen] = useState(false);
  const [selectedContainer, setSelectedContainer] = useState('');
  const [execOpen, setExecOpen] = useState(false);

  const handleViewLogs = useCallback((containerName?: string) => {
    setSelectedContainer(containerName || '');
    setLogViewerOpen(true);
  }, []);

  const handleCloseLogs = useCallback(() => {
    setLogViewerOpen(false);
    setSelectedContainer('');
  }, []);

  const handleOpenExec = useCallback((containerName?: string) => {
    setSelectedContainer(containerName || '');
    setExecOpen(true);
  }, []);

  const handleCloseExec = useCallback(() => {
    setExecOpen(false);
    setSelectedContainer('');
  }, []);

  const podProperties = useMemo(() => {
    if (!item) return null;

    const metadata = item.metadata || {};
    const spec = item.spec || {};
    const status = item.status || {};

    return {
      name: metadata.name ?? '-',
      namespace: metadata.namespace ?? '',
      creationTimestamp: metadata.creationTimestamp ?? '',
      labels: metadata.labels,
      nodeName: (spec as any)?.nodeName ?? '-',
      qosClass: (status as any)?.qosClass ?? '-',
      ownerReferences: metadata.ownerReferences?.map((o) => o.name).join(', ') || '-',
      restartCount:
        (status as any)?.containerStatuses?.reduce(
          (acc: number, s: any) => acc + (s.restartCount || 0),
          0
        ) ?? 0,
      podIP: (status as any)?.podIP ?? '-',
      hostIP: (status as any)?.hostIP ?? '-',
      serviceAccount: (spec as any)?.serviceAccountName ?? 'default',
      status: getPodStatus(item),
      containers: (spec as any)?.containers || [],
    };
  }, [item]);

  const renderProperties = useCallback(() => {
    if (!podProperties) return null;

    return (
      <div className="space-y-4">
        <div className="overflow-hidden rounded-lg border border-white/10 bg-white/5">
          <Table className="table-fixed">
            <colgroup>
              <col className="w-1/4" />
              <col className="w-3/4" />
            </colgroup>
            <Tbody>
              <Tr>
                <Td>Name</Td>
                <Td className="break-all text-white">{podProperties.name}</Td>
              </Tr>

              <Tr>
                <Td>Namespace</Td>
                <Td>
                  <BadgeNamespaces name={podProperties.namespace} />
                </Td>
              </Tr>

              <Tr>
                <Td>Age</Td>
                <AgeCell timestamp={podProperties.creationTimestamp} />
              </Tr>

              <TableYamlRow label="Labels" data={podProperties.labels} maxWidthClass="lg" />

              <Tr>
                <Td>Node</Td>
                <Td>{podProperties.nodeName}</Td>
              </Tr>

              <Tr>
                <Td>QoS</Td>
                <Td>{podProperties.qosClass}</Td>
              </Tr>

              <Tr>
                <Td>Controlled By</Td>
                <Td>{podProperties.ownerReferences}</Td>
              </Tr>

              <Tr>
                <Td>Restarts</Td>
                <Td>{podProperties.restartCount}</Td>
              </Tr>

              <Tr>
                <Td>Pod IP</Td>
                <Td>{podProperties.podIP}</Td>
              </Tr>

              <Tr>
                <Td>Host IP</Td>
                <Td>{podProperties.hostIP}</Td>
              </Tr>

              <Tr>
                <Td>Service Account</Td>
                <Td>{podProperties.serviceAccount}</Td>
              </Tr>

              <Tr>
                <Td>Status</Td>
                <Td>
                  <BadgeStatus status={podProperties.status} />
                </Td>
              </Tr>
            </Tbody>
          </Table>
        </div>

        <div className="overflow-hidden rounded-lg border border-white/10 bg-white/5">
          <div className="p-4">
            <div className="space-y-3">
              {podProperties.containers.map((container: any) => {
                const status = containerStatuses.find((s) => s.name === container.name);
                const isReady = status?.ready ?? false;

                return (
                  <div
                    key={container.name}
                    className="flex items-start justify-between rounded-lg border border-white/10 p-3"
                  >
                    <div className="flex flex-1 items-start gap-3">
                      <div
                        className={`mt-1.5 h-3 w-3 rounded-full ${isReady ? 'bg-green-500' : 'bg-yellow-500'}`}
                        title={isReady ? 'Ready' : 'Not Ready'}
                      />
                      <div className="flex-1">
                        <div className="font-medium text-white">{container.name}</div>
                        <div className="text-sm text-white/60">{container.image}</div>
                        {status?.message && (
                          <div className="mt-1 text-sm text-red-400">{status.message}</div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-shrink-0 gap-2">
                      <ButtonLog onClick={() => handleViewLogs(container.name)} />
                      <ButtonShell onClick={() => handleOpenExec(container.name)} />
                    </div>
                  </div>
                );
              })}

              {podProperties.containers.length === 0 && (
                <div className="py-4 text-center text-white/60">No containers</div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }, [podProperties, containerStatuses, handleViewLogs, handleOpenExec]);

  const sections = useMemo(
    () =>
      item
        ? [
            {
              key: 'properties',
              title: 'Properties',
              content: renderProperties,
            },
          ]
        : [],
    [item, renderProperties]
  );

  const logViewerTitle = useMemo(
    () =>
      item
        ? `Logs: ${item.metadata?.name}${selectedContainer ? ` - ${selectedContainer}` : ''}`
        : '',
    [item, selectedContainer]
  );

  const execTerminalTitle = useMemo(
    () =>
      item
        ? `Shell: ${item.metadata?.name}${selectedContainer ? ` - ${selectedContainer}` : ''}`
        : '',
    [item, selectedContainer]
  );

  const shouldShowLogViewer = item && logViewerOpen;
  const shouldShowExecTerminal = item && execOpen;

  return (
    <>
      <RightSidebarGeneric
        item={item}
        setItem={setItem}
        sections={sections}
        onDelete={onDelete}
        onEdit={onEdit}
        updating={updating}
        deleting={deleting}
      />

      {shouldShowLogViewer && (
        <BottomLogViewer
          open={logViewerOpen}
          title={logViewerTitle}
          podName={item.metadata?.name || ''}
          namespace={item.metadata?.namespace || ''}
          contextName={contextName}
          containerName={selectedContainer || undefined}
          onClose={handleCloseLogs}
        />
      )}

      {shouldShowExecTerminal && (
        <BottomExecTerminal
          open={execOpen}
          title={execTerminalTitle}
          podName={item.metadata?.name || ''}
          namespace={item.metadata?.namespace || ''}
          contextName={contextName}
          containerName={selectedContainer || undefined}
          onClose={handleCloseExec}
        />
      )}
    </>
  );
}
