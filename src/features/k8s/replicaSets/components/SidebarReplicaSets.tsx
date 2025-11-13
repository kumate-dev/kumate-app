import type { V1ReplicaSet } from '@kubernetes/client-node';
import { Table, Tbody, Td, Tr } from '@/components/ui/table';
import { useCallback, useMemo, useState } from 'react';
import AgeCell from '@/components/common/AgeCell';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import { TableYamlRow } from '@/components/common/TableYamlRow';
import { RightSidebarGeneric } from '../../generic/components/RightSidebarGeneric';
import { BadgeStatus } from '../../generic/components/BadgeStatus';
import { getReplicaSetStatus } from '../utils/replicaSetStatus';
import { ButtonForward } from '@/components/common/ButtonForward';
import { ModalPortForwarder } from '@/components/common/ModalPortForwarder';

interface SidebarReplicaSetsProps {
  item: V1ReplicaSet | null;
  setItem: (item: V1ReplicaSet | null) => void;
  onDelete?: (item: V1ReplicaSet) => void;
  onEdit?: (item: V1ReplicaSet) => void;
  updating?: boolean;
  deleting?: boolean;
  contextName?: string;
}

export function SidebarReplicaSets({
  item,
  setItem,
  onDelete,
  onEdit,
  contextName,
  updating = false,
  deleting = false,
}: SidebarReplicaSetsProps) {
  const [pfDialogOpen, setPfDialogOpen] = useState(false);
  const [selectedRemotePort, setSelectedRemotePort] = useState<number | undefined>(undefined);

  const renderProperties = useCallback(
    (rs: V1ReplicaSet) => (
      <div className="overflow-hidden rounded-lg border border-white/10 bg-white/5">
        <Table className="table-fixed">
          <colgroup>
            <col className="w-1/4" />
            <col className="w-3/4" />
          </colgroup>
          <Tbody>
            <Tr>
              <Td>Name</Td>
              <Td className="break-all text-white">{rs.metadata?.name ?? '-'}</Td>
            </Tr>

            <Tr>
              <Td>Namespace</Td>
              <Td>
                <BadgeNamespaces name={rs.metadata?.namespace ?? ''} />
              </Td>
            </Tr>

            <Tr>
              <Td>Age</Td>
              <AgeCell timestamp={rs.metadata?.creationTimestamp ?? ''} />
            </Tr>

            <TableYamlRow label="Labels" data={rs.metadata?.labels} maxWidthClass="lg" />
            <TableYamlRow label="Annotations" data={rs.metadata?.annotations} maxWidthClass="xl" />

            <Tr>
              <Td>Replicas</Td>
              <Td>{rs.spec?.replicas ?? '-'}</Td>
            </Tr>

            <Tr>
              <Td>Status</Td>
              <Td>
                <BadgeStatus status={getReplicaSetStatus(rs)} />
              </Td>
            </Tr>

            {(() => {
              const containers = rs.spec?.template?.spec?.containers || [];
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
                                  <ButtonForward
                                    onClick={() => {
                                      setSelectedRemotePort(p.containerPort || 0);
                                      setPfDialogOpen(true);
                                    }}
                                    disabled={!contextName || deleting || updating}
                                  />
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
              content: (i: V1ReplicaSet) => (
                <>
                  {renderProperties(i)}
                  <ModalPortForwarder
                    open={pfDialogOpen}
                    onOpenChange={setPfDialogOpen}
                    contextName={contextName}
                    namespace={i.metadata?.namespace || ''}
                    resourceKind="replicaset"
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
      eventsProps={
        item
          ? {
              contextName,
              namespace: item?.metadata?.namespace,
              resourceKind: 'ReplicaSet',
              resourceName: item?.metadata?.name,
            }
          : undefined
      }
      onDelete={onDelete}
      onEdit={onEdit}
      updating={updating}
      deleting={deleting}
    />
  );
}
