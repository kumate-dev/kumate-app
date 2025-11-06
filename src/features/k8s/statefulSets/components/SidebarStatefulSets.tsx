import type { V1StatefulSet } from '@kubernetes/client-node';
import { Table, Tbody, Td, Tr } from '@/components/ui/table';
import { useCallback, useMemo, useState } from 'react';
import AgeCell from '@/components/common/AgeCell';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import { TableYamlRow } from '@/components/common/TableYamlRow';
import { RightSidebarGeneric } from '../../generic/components/RightSidebarGeneric';
import { BadgeStatus } from '../../generic/components/BadgeStatus';
import { getStatefulSetStatus } from '../utils/statefulSetStatus';
import { Button } from '@/components/ui/button';
import { ModalPortForwarder } from '@/features/k8s/portForwarding/components/ModalPortForwarder';

interface SidebarStatefulSetsProps {
  item: V1StatefulSet | null;
  setItem: (item: V1StatefulSet | null) => void;
  onDelete?: (item: V1StatefulSet) => void;
  onEdit?: (item: V1StatefulSet) => void;
  updating?: boolean;
  deleting?: boolean;
}

interface SidebarStatefulSetsProps {
  item: V1StatefulSet | null;
  setItem: (item: V1StatefulSet | null) => void;
  onDelete?: (item: V1StatefulSet) => void;
  onEdit?: (item: V1StatefulSet) => void;
  updating?: boolean;
  deleting?: boolean;
  contextName?: string;
}

export function SidebarStatefulSets({
  item,
  setItem,
  onDelete,
  onEdit,
  contextName,
  updating = false,
  deleting = false,
}: SidebarStatefulSetsProps) {
  const [pfDialogOpen, setPfDialogOpen] = useState(false);
  const [selectedRemotePort, setSelectedRemotePort] = useState<number | undefined>(undefined);
  const renderProperties = useCallback(
    (ss: V1StatefulSet) => (
      <div className="overflow-hidden rounded-lg border border-white/10 bg-white/5">
        <Table className="table-fixed">
          <colgroup>
            <col className="w-1/4" />
            <col className="w-3/4" />
          </colgroup>
          <Tbody>
            <Tr>
              <Td>Name</Td>
              <Td className="break-all text-white">{ss.metadata?.name ?? '-'}</Td>
            </Tr>

            <Tr>
              <Td>Namespace</Td>
              <Td>
                <BadgeNamespaces name={ss.metadata?.namespace ?? ''} />
              </Td>
            </Tr>

            <Tr>
              <Td>Age</Td>
              <AgeCell timestamp={ss.metadata?.creationTimestamp ?? ''} />
            </Tr>

            <TableYamlRow label="Labels" data={ss.metadata?.labels} maxWidthClass="lg" />
            <TableYamlRow label="Annotations" data={ss.metadata?.annotations} maxWidthClass="xl" />

            <Tr>
              <Td>Replicas</Td>
              <Td>{ss.spec?.replicas ?? 0}</Td>
            </Tr>

            <Tr>
              <Td>Update Strategy</Td>
              <Td>{ss.spec?.updateStrategy?.type ?? '-'}</Td>
            </Tr>

            <Tr>
              <Td>Status</Td>
              <Td>
                <BadgeStatus status={getStatefulSetStatus(ss)} />
              </Td>
            </Tr>

            {(() => {
              const containers = ss.spec?.template?.spec?.containers || [];
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
              content: (i: V1StatefulSet) => (
                <>
                  {renderProperties(i)}
                  <ModalPortForwarder
                    open={pfDialogOpen}
                    onOpenChange={setPfDialogOpen}
                    contextName={contextName}
                    namespace={i.metadata?.namespace || ''}
                    resourceKind="statefulset"
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
