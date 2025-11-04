import type { V1Pod } from '@kubernetes/client-node';
import { Table, Tbody, Td, Tr } from '@/components/ui/table';
import { SidebarGeneric } from '../../generic/components/SidebarGeneric';
import AgeCell from '@/components/common/AgeCell';
import { TableYamlRow } from '@/components/common/TableYamlRow';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import { BadgeStatus } from '../../generic/components/BadgeStatus';
import { getPodStatus } from '../utils/podStatus';
import { getContainerStatuses } from '../utils/containerStatus';
import { ButtonLog } from '@/components/common/ButtonLog';
import BottomExecTerminal from '@/components/common/BottomExecTerminal';
import { Terminal } from 'lucide-react';
import { useState } from 'react';
import BottomLogViewer from '@/components/common/BottomLogViewer';
import { ButtonShell } from '@/components/common/ButtonShell';

interface SidebarPodsProps {
  item: V1Pod | null;
  setItem: (item: V1Pod | null) => void;
  onDelete?: (item: V1Pod) => void;
  onEdit?: (item: V1Pod) => void;
  contextName?: string;
}

export function SidebarPods({ item, setItem, onDelete, onEdit, contextName }: SidebarPodsProps) {
  const containerStatuses = item ? getContainerStatuses(item) : [];
  const [logViewerOpen, setLogViewerOpen] = useState(false);
  const [selectedContainer, setSelectedContainer] = useState<string>('');
  const [execOpen, setExecOpen] = useState(false);

  const handleViewLogs = (containerName?: string) => {
    setSelectedContainer(containerName || '');
    setLogViewerOpen(true);
  };

  const handleCloseLogs = () => {
    setLogViewerOpen(false);
    setSelectedContainer('');
  };

  const handleOpenExec = (containerName?: string) => {
    setSelectedContainer(containerName || '');
    setExecOpen(true);
  };

  const handleCloseExec = () => {
    setExecOpen(false);
    setSelectedContainer('');
  };

  const renderOverview = (pod: V1Pod) => (
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
              <Td className="break-all text-white">{pod.metadata?.name ?? '-'}</Td>
            </Tr>

            <Tr>
              <Td>Namespace</Td>
              <Td>
                <BadgeNamespaces name={pod.metadata?.namespace ?? ''} />
              </Td>
            </Tr>

            <Tr>
              <Td>Age</Td>
              <AgeCell timestamp={pod.metadata?.creationTimestamp ?? ''} />
            </Tr>

            <TableYamlRow label="Labels" data={pod.metadata?.labels} maxWidthClass="lg" />

            <Tr>
              <Td>Node</Td>
              <Td>{pod.spec?.nodeName ?? '-'}</Td>
            </Tr>

            <Tr>
              <Td>QoS</Td>
              <Td>{pod.status?.qosClass ?? '-'}</Td>
            </Tr>

            <Tr>
              <Td>Controlled By</Td>
              <Td>{pod.metadata?.ownerReferences?.map((o) => o.name).join(', ') || '-'}</Td>
            </Tr>

            <Tr>
              <Td>Restarts</Td>
              <Td>
                {pod.status?.containerStatuses?.reduce(
                  (acc, s) => acc + (s.restartCount || 0),
                  0
                ) ?? 0}
              </Td>
            </Tr>

            <Tr>
              <Td>Pod IP</Td>
              <Td>{pod.status?.podIP ?? '-'}</Td>
            </Tr>

            <Tr>
              <Td>Host IP</Td>
              <Td>{pod.status?.hostIP ?? '-'}</Td>
            </Tr>

            <Tr>
              <Td>Service Account</Td>
              <Td>{pod.spec?.serviceAccountName ?? 'default'}</Td>
            </Tr>

            <Tr>
              <Td>Status</Td>
              <Td>
                <BadgeStatus status={getPodStatus(pod)} />
              </Td>
            </Tr>
          </Tbody>
        </Table>
      </div>

      <div className="overflow-hidden rounded-lg border border-white/10 bg-white/5">
        <div className="p-4">
          <div className="space-y-3">
            {pod.spec?.containers?.map((container, _) => {
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
                    <ButtonLog onViewLogs={() => handleViewLogs(container.name)} />
                    <ButtonShell onOpenShell={() => handleOpenExec(container.name)} />
                  </div>
                </div>
              );
            })}

            {!pod.spec?.containers?.length && (
              <div className="py-4 text-center text-white/60">No containers</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const sections = item
    ? [
        {
          key: 'properties',
          title: 'Properties',
          content: (i: V1Pod) => renderOverview(i),
        },
      ]
    : [];

  return (
    <>
      <SidebarGeneric
        item={item}
        setItem={setItem}
        sections={sections}
        onDelete={onDelete}
        onEdit={onEdit}
      />

      {item && (
        <BottomLogViewer
          open={logViewerOpen}
          title={`Logs: ${item.metadata?.name}${selectedContainer ? ` - ${selectedContainer}` : ''}`}
          podName={item.metadata?.name || ''}
          namespace={item.metadata?.namespace || ''}
          contextName={contextName}
          containerName={selectedContainer || undefined}
          onClose={handleCloseLogs}
        />
      )}

      {item && (
        <BottomExecTerminal
          open={execOpen}
          title={`Shell: ${item.metadata?.name}${selectedContainer ? ` - ${selectedContainer}` : ''}`}
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
