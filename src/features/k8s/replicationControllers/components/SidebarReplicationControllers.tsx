import type { V1ReplicationController } from '@kubernetes/client-node';
import { Table, Tbody, Td, Tr } from '@/components/ui/table';
import { useCallback, useMemo, useState } from 'react';
import AgeCell from '@/components/common/AgeCell';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import { TableYamlRow } from '@/components/common/TableYamlRow';
import { RightSidebarGeneric } from '../../generic/components/RightSidebarGeneric';
import { BadgeStatus } from '../../generic/components/BadgeStatus';
import { getReplicationControllerStatus } from '../utils/replicationControllerStatus';
import { toast } from 'sonner';
import { ButtonScale } from '@/components/common/ButtonScale';
import { ButtonRestart } from '@/components/common/ButtonRestart';
import {
  restartReplicationController,
  scaleReplicationController,
} from '@/api/k8s/replicationControllers';
import { ModalRestart } from '@/components/common/ModalRestart';
import { ModalScale } from '@/components/common/ModalScale';

interface SidebarReplicationControllersProps {
  item: V1ReplicationController | null;
  setItem: (item: V1ReplicationController | null) => void;
  onDelete?: (item: V1ReplicationController) => void;
  onEdit?: (item: V1ReplicationController) => void;
  updating?: boolean;
  deleting?: boolean;
  contextName?: string;
}

export function SidebarReplicationControllers({
  item,
  setItem,
  onDelete,
  onEdit,
  contextName,
  updating = false,
  deleting = false,
}: SidebarReplicationControllersProps) {
  const [patching, setPatching] = useState(false);
  const [confirmRestartOpen, setConfirmRestartOpen] = useState(false);
  const [scaleDialogOpen, setScaleDialogOpen] = useState(false);
  const [scale, setScale] = useState<number>(item?.spec?.replicas ?? 0);

  const handleRestart = useCallback(
    async (rc: V1ReplicationController) => {
      if (!contextName || !rc.metadata?.name) return;
      setPatching(true);
      try {
        await restartReplicationController({
          name: contextName,
          namespace: rc.metadata?.namespace,
          resourceName: rc.metadata?.name || '',
        });
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
    async (rc: V1ReplicationController) => {
      if (!contextName || !rc.metadata?.name) return;
      setPatching(true);
      try {
        await scaleReplicationController({
          name: contextName,
          namespace: rc.metadata?.namespace,
          resourceName: rc.metadata?.name || '',
          replicas: Math.max(0, Number(scale) || 0),
        });
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
    (rc: V1ReplicationController) => (
      <div className="overflow-hidden rounded-lg border border-white/10 bg-white/5">
        <Table className="table-fixed">
          <colgroup>
            <col className="w-1/4" />
            <col className="w-3/4" />
          </colgroup>
          <Tbody>
            <Tr>
              <Td>Name</Td>
              <Td className="break-all text-white">{rc.metadata?.name ?? '-'}</Td>
            </Tr>

            <Tr>
              <Td>Namespace</Td>
              <Td>
                <BadgeNamespaces name={rc.metadata?.namespace ?? ''} />
              </Td>
            </Tr>

            <Tr>
              <Td>Age</Td>
              <AgeCell timestamp={rc.metadata?.creationTimestamp ?? ''} />
            </Tr>

            <TableYamlRow label="Labels" data={rc.metadata?.labels} maxWidthClass="lg" />
            <TableYamlRow label="Annotations" data={rc.metadata?.annotations} maxWidthClass="xl" />

            <Tr>
              <Td>Replicas</Td>
              <Td>{rc.spec?.replicas ?? '-'}</Td>
            </Tr>

            <Tr>
              <Td>Status</Td>
              <Td>
                <BadgeStatus status={getReplicationControllerStatus(rc)} />
              </Td>
            </Tr>
          </Tbody>
        </Table>
      </div>
    ),
    []
  );

  const sections = useMemo(
    () =>
      item
        ? [
            {
              key: 'properties',
              title: 'Properties',
              headerRight: (i: V1ReplicationController) => (
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
              content: (rc: V1ReplicationController) => (
                <>
                  {renderProperties(rc)}

                  <ModalRestart
                    open={confirmRestartOpen}
                    onOpenChange={setConfirmRestartOpen}
                    patching={patching}
                    title="Confirm Restart ReplicationController"
                    resourceLabel="replication controller"
                    resourceName={rc.metadata?.name}
                    onConfirm={() => handleRestart(rc)}
                  />

                  <ModalScale
                    open={scaleDialogOpen}
                    onOpenChange={setScaleDialogOpen}
                    patching={patching}
                    title="Adjust Replica Count"
                    resourceLabel="replication controller"
                    resourceName={rc.metadata?.name}
                    scale={scale}
                    onScaleChange={setScale}
                    onConfirm={() => handleScaleApply(rc)}
                  />
                </>
              ),
            },
          ]
        : [],
    [
      item,
      renderProperties,
      deleting,
      contextName,
      updating,
      patching,
      confirmRestartOpen,
      scaleDialogOpen,
      scale,
      handleRestart,
      handleScaleApply,
    ]
  );

  return (
    <RightSidebarGeneric
      item={item}
      setItem={setItem}
      sections={sections}
      eventsProps={item ? {
        contextName,
        namespace: item?.metadata?.namespace,
        resourceKind: 'ReplicationController',
        resourceName: item?.metadata?.name,
      } : undefined}
      onDelete={onDelete}
      onEdit={onEdit}
      updating={updating}
      deleting={deleting}
    />
  );
}
