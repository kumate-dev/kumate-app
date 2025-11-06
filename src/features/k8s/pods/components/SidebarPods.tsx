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
import { Button } from '@/components/ui/button';
import { ModalPortForwarder } from '@/features/k8s/portForwarding/components/ModalPortForwarder';

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
  const [pfDialogOpen, setPfDialogOpen] = useState(false);
  const [selectedRemotePort, setSelectedRemotePort] = useState<number | undefined>(undefined);

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

  const handleOpenPortForward = useCallback((remote?: number) => {
    setSelectedRemotePort(remote);
    setPfDialogOpen(true);
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
                    className="overflow-hidden rounded-lg border border-white/10 bg-white/5"
                  >
                    <Table className="table-fixed">
                      <colgroup>
                        <col className="w-1/4" />
                        <col className="w-3/4" />
                      </colgroup>
                      <Tbody>
                        <Tr>
                          <Td>Container</Td>
                          <Td>
                            <div className="flex items-center gap-2 text-white">
                              <span
                                className={`inline-block h-2.5 w-2.5 rounded-full ${isReady ? 'bg-green-500' : 'bg-yellow-500'}`}
                                aria-label={isReady ? 'Ready' : 'Not Ready'}
                              />
                              <span className="font-medium">{container.name}</span>
                            </div>
                          </Td>
                        </Tr>
                        <Tr>
                          <Td>Image</Td>
                          <Td className="text-white/80">{container.image}</Td>
                        </Tr>
                        {status?.message && (
                          <Tr>
                            <Td>Message</Td>
                            <Td className="text-red-400">{status.message}</Td>
                          </Tr>
                        )}
                        <Tr>
                          <Td>Actions</Td>
                          <Td>
                            <div className="flex gap-2">
                              <ButtonLog onClick={() => handleViewLogs(container.name)} />
                              <ButtonShell onClick={() => handleOpenExec(container.name)} />
                            </div>
                          </Td>
                        </Tr>
                        {(container.ports || []).length > 0 && (
                          <Tr>
                            <Td>Ports</Td>
                            <Td>
                              <div className="rounded-md border border-white/10 bg-white/5">
                                <Table className="w-full table-fixed">
                                  <colgroup>
                                    <col className="w-auto" />
                                    <col className="w-[120px]" />
                                  </colgroup>
                                  <Tbody>
                                    {(container.ports || []).map((p: any, idx: number) => (
                                      <Tr key={`${container.name}-${p.containerPort}-${idx}`}>
                                        <Td>
                                          <span className="text-white">{p.containerPort}</span>
                                          <span className="text-white/60">
                                            /{p.protocol || 'TCP'}
                                          </span>
                                          {p.name && (
                                            <span className="ml-2 text-white/60">{p.name}</span>
                                          )}
                                        </Td>
                                        <Td className="text-right">
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="min-w-[96px] px-3"
                                            onClick={() => handleOpenPortForward(p.containerPort)}
                                            disabled={!item}
                                          >
                                            Forward...
                                          </Button>
                                        </Td>
                                      </Tr>
                                    ))}
                                  </Tbody>
                                </Table>
                              </div>
                            </Td>
                          </Tr>
                        )}
                      </Tbody>
                    </Table>
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
              headerRight: (_i: V1Pod) => null,
              content: (_i: V1Pod) => renderProperties(),
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
  const shouldShowPortForwarderDialog = item && pfDialogOpen;

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

      {shouldShowPortForwarderDialog && (
        <ModalPortForwarder
          open={pfDialogOpen}
          onOpenChange={setPfDialogOpen}
          contextName={contextName}
          namespace={item.metadata?.namespace || ''}
          resourceKind="pod"
          resourceName={item.metadata?.name || ''}
          defaultRemotePort={selectedRemotePort}
        />
      )}
    </>
  );
}
