import type { V1DaemonSet } from '@kubernetes/client-node';
import { Table, Tbody, Td, Tr } from '@/components/ui/table';
import { useCallback, useMemo, useState } from 'react';
import AgeCell from '@/components/common/AgeCell';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import { TableYamlRow } from '@/components/common/TableYamlRow';
import { RightSidebarGeneric } from '../../generic/components/RightSidebarGeneric';
import { BadgeStatus } from '../../generic/components/BadgeStatus';
import { getDaemonSetStatus } from '../utils/daemonSetStatus';
import { Button } from '@/components/ui/button';
import { ModalPortForwarder } from '@/components/common/ModalPortForwarder';

interface SidebarDaemonSetsProps {
  item: V1DaemonSet | null;
  setItem: (item: V1DaemonSet | null) => void;
  onDelete?: (item: V1DaemonSet) => void;
  onEdit?: (item: V1DaemonSet) => void;
  updating?: boolean;
  deleting?: boolean;
  contextName?: string;
}

export function SidebarDaemonSets({
  item,
  setItem,
  onDelete,
  onEdit,
  contextName,
  updating = false,
  deleting = false,
}: SidebarDaemonSetsProps) {
  const [pfDialogOpen, setPfDialogOpen] = useState(false);
  const [selectedRemotePort, setSelectedRemotePort] = useState<number | undefined>(undefined);
  const renderProperties = useCallback(
    (ds: V1DaemonSet) => (
      <div className="overflow-hidden rounded-lg border border-white/10 bg-white/5">
        <Table className="table-fixed">
          <colgroup>
            <col className="w-1/4" />
            <col className="w-3/4" />
          </colgroup>
          <Tbody>
            <Tr>
              <Td>Name</Td>
              <Td className="break-all text-white">{ds.metadata?.name ?? '-'}</Td>
            </Tr>

            <Tr>
              <Td>Namespace</Td>
              <Td>
                <BadgeNamespaces name={ds.metadata?.namespace ?? ''} />
              </Td>
            </Tr>

            <Tr>
              <Td>Age</Td>
              <AgeCell timestamp={ds.metadata?.creationTimestamp ?? ''} />
            </Tr>

            <TableYamlRow label="Labels" data={ds.metadata?.labels} maxWidthClass="lg" />
            <TableYamlRow label="Annotations" data={ds.metadata?.annotations} maxWidthClass="xl" />

            <Tr>
              <Td>Desired</Td>
              <Td>{ds.status?.desiredNumberScheduled ?? '-'}</Td>
            </Tr>

            <Tr>
              <Td>Ready</Td>
              <Td>{ds.status?.numberReady ?? '-'}</Td>
            </Tr>

            <Tr>
              <Td>Status</Td>
              <Td>
                <BadgeStatus status={getDaemonSetStatus(ds)} />
              </Td>
            </Tr>

            {(() => {
              const containers = ds.spec?.template?.spec?.containers || [];
              const ports = containers.flatMap((c) =>
                (c.ports || []).map((p) => ({ ...p, __containerName: c.name }))
              );
              return (
                <Tr>
                  <Td>Ports</Td>
                  <Td className="break-all">
                    {ports.length === 0 ? (
                      '-'
                    ) : (
                      <div className="rounded-md border border-white/10 bg-white/5">
                        <Table className="w-full table-fixed">
                          <colgroup>
                            <col className="w-auto" />
                            <col className="w-[120px]" />
                          </colgroup>
                          <Tbody>
                            {ports.map((p, idx) => (
                              <Tr key={idx}>
                                <Td>
                                  <span className="mr-2 text-white/70">{p.__containerName}</span>
                                  <span className="text-white">{p.containerPort}</span>
                                  <span className="text-white/60">/{p.protocol || 'TCP'}</span>
                                  {p.name && <span className="ml-2 text-white/60">{p.name}</span>}
                                </Td>
                                <Td className="text-right">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="min-w-[96px] px-3"
                                    onClick={() => {
                                      setSelectedRemotePort(p.containerPort || 0);
                                      setPfDialogOpen(true);
                                    }}
                                    disabled={!contextName || deleting || updating}
                                  >
                                    Forward...
                                  </Button>
                                </Td>
                              </Tr>
                            ))}
                          </Tbody>
                        </Table>
                      </div>
                    )}
                  </Td>
                </Tr>
              );
            })()}
          </Tbody>
        </Table>
      </div>
    ),
    [contextName, deleting, updating]
  );

  const sections = useMemo(
    () =>
      item
        ? [
            {
              key: 'properties',
              title: 'Properties',
              content: (i: V1DaemonSet) => (
                <>
                  {renderProperties(i)}
                  <ModalPortForwarder
                    open={pfDialogOpen}
                    onOpenChange={setPfDialogOpen}
                    contextName={contextName}
                    namespace={i.metadata?.namespace || ''}
                    resourceKind="daemonset"
                    resourceName={i.metadata?.name || ''}
                    defaultRemotePort={selectedRemotePort}
                  />
                </>
              ),
            },
          ]
        : [],
    [item, renderProperties, pfDialogOpen, selectedRemotePort, contextName]
  );

  return (
    <RightSidebarGeneric
      item={item}
      setItem={setItem}
      sections={sections}
      onDelete={onDelete}
      onEdit={onEdit}
      updating={updating}
      deleting={deleting}
    />
  );
}
