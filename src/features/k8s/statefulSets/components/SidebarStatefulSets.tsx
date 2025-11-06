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
import { toast } from 'sonner';
import { ButtonRestart } from '@/components/common/ButtonRestart';
import { ButtonScale } from '@/components/common/ButtonScale';
import { restartStatefulSet, scaleStatefulSet } from '@/api/k8s/statefulSets';
import { ModalRestart } from '@/components/common/ModalRestart';
import { ModalScale } from '@/components/common/ModalScale';

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
  const [scale, setScale] = useState<number>(item?.spec?.replicas ?? 0);
  const [patching, setPatching] = useState(false);
  const [confirmRestartOpen, setConfirmRestartOpen] = useState(false);
  const [scaleDialogOpen, setScaleDialogOpen] = useState(false);

  const handleRestart = useCallback(
    async (ss: V1StatefulSet) => {
      if (!contextName || !ss.metadata?.name) return;
      setPatching(true);
      try {
        await restartStatefulSet({
          name: contextName,
          namespace: ss.metadata?.namespace,
          resourceName: ss.metadata?.name || '',
        });
        toast.success('StatefulSet restarted');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        toast.error(`Restart failed: ${msg}`);
      } finally {
        setPatching(false);
        setConfirmRestartOpen(false);
      }
    },
    [contextName]
  );

  const handleScaleApply = useCallback(
    async (ss: V1StatefulSet) => {
      if (!contextName || !ss.metadata?.name) return;
      setPatching(true);
      try {
        await scaleStatefulSet({
          name: contextName,
          namespace: ss.metadata?.namespace,
          resourceName: ss.metadata?.name || '',
          replicas: Math.max(0, Number(scale) || 0),
        });
        toast.success('StatefulSet scaled');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        toast.error(`Scale failed: ${msg}`);
      } finally {
        setPatching(false);
        setScaleDialogOpen(false);
      }
    },
    [scale, contextName]
  );
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
              headerRight: (i: V1StatefulSet) => (
                <>
                  <ButtonScale
                    onClick={() => {
                      setScale(i.spec?.replicas ?? 0);
                      setScaleDialogOpen(true);
                    }}
                    disabled={deleting || !contextName || updating || patching}
                  />
                  <ButtonRestart
                    onClick={() => setConfirmRestartOpen(true)}
                    disabled={deleting || !contextName || updating || patching}
                  />
                </>
              ),
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

                  <ModalRestart
                    open={confirmRestartOpen}
                    onOpenChange={setConfirmRestartOpen}
                    patching={patching}
                    title="Confirm Restart StatefulSet"
                    resourceLabel="stateful set"
                    resourceName={i.metadata?.name}
                    onConfirm={() => handleRestart(i)}
                  />

                  <ModalScale
                    open={scaleDialogOpen}
                    onOpenChange={setScaleDialogOpen}
                    patching={patching}
                    title="Adjust Replica Count"
                    resourceLabel="stateful set"
                    resourceName={i.metadata?.name}
                    scale={scale}
                    onScaleChange={setScale}
                    onConfirm={() => handleScaleApply(i)}
                  />
                </>
              ),
            },
          ]
        : [],
    [
      item,
      renderProperties,
      pfDialogOpen,
      selectedRemotePort,
      contextName,
      confirmRestartOpen,
      scaleDialogOpen,
      scale,
      deleting,
      updating,
      patching,
      handleRestart,
      handleScaleApply,
    ]
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
