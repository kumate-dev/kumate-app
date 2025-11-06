import type { V1Deployment } from '@kubernetes/client-node';
import { Table, Tbody, Td, Tr } from '@/components/ui/table';
import { useCallback, useMemo, useEffect, useState } from 'react';
import AgeCell from '@/components/common/AgeCell';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import { TableYamlRow } from '@/components/common/TableYamlRow';
import { RightSidebarGeneric } from '../../generic/components/RightSidebarGeneric';
import { BadgeStatus } from '../../generic/components/BadgeStatus';
import { getDeploymentStatus } from '../utils/deploymentStatus';
import { restartDeployment, scaleDeployment } from '@/api/k8s/deployments';
import { toast } from 'sonner';
import { ButtonRestart } from '@/components/common/ButtonRestart';
import { ButtonScale } from '@/components/common/ButtonScale';
import { ModalDeploymentRestart } from './ModalDeploymentRestart';
import { ModalDeploymentScaleDialog } from './ModalDeploymentScale';

interface SidebarDeploymentsProps {
  item: V1Deployment | null;
  setItem: (item: V1Deployment | null) => void;
  onDelete?: (item: V1Deployment) => void;
  onEdit?: (item: V1Deployment) => void;
  contextName?: string;
  updating?: boolean;
  deleting?: boolean;
}

export function SidebarDeployments({
  item,
  setItem,
  onDelete,
  onEdit,
  contextName,
  updating = false,
  deleting = false,
}: SidebarDeploymentsProps) {
  const [scale, setScale] = useState<number>(item?.spec?.replicas ?? 0);
  const [patching, setPatching] = useState(false);
  const [confirmRestartOpen, setConfirmRestartOpen] = useState(false);
  const [scaleDialogOpen, setScaleDialogOpen] = useState(false);

  useEffect(() => {
    setScale(item?.spec?.replicas ?? 0);
  }, [item]);

  const handleRestart = useCallback(
    async (dep: V1Deployment) => {
      if (!contextName || !dep.metadata?.name) return;
      setPatching(true);
      try {
        await restartDeployment({
          name: contextName,
          namespace: dep.metadata?.namespace,
          resourceName: dep.metadata.name,
        });
        toast.success('Deployment restarted');
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
    async (dep: V1Deployment) => {
      if (!contextName || !dep.metadata?.name) return;
      setPatching(true);
      try {
        await scaleDeployment({
          name: contextName,
          namespace: dep.metadata?.namespace,
          resourceName: dep.metadata.name,
          replicas: Math.max(0, Number(scale) || 0),
        });
        toast.success('Deployment scaled');
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
    (dep: V1Deployment) => (
      <div className="overflow-hidden rounded-lg border border-white/10 bg-white/5">
        <Table className="table-fixed">
          <colgroup>
            <col className="w-1/4" />
            <col className="w-3/4" />
          </colgroup>
          <Tbody>
            <Tr>
              <Td>Name</Td>
              <Td className="break-all text-white">{dep.metadata?.name ?? '-'}</Td>
            </Tr>

            <Tr>
              <Td>Age</Td>
              <AgeCell timestamp={dep.metadata?.creationTimestamp ?? ''} />
            </Tr>

            <Tr>
              <Td>Namespace</Td>
              <Td>
                <BadgeNamespaces name={dep.metadata?.namespace ?? ''} />
              </Td>
            </Tr>

            <TableYamlRow label="Labels" data={dep.metadata?.labels} maxWidthClass="lg" />
            <TableYamlRow label="Annotations" data={dep.metadata?.annotations} maxWidthClass="xl" />

            <Tr>
              <Td>Replicas</Td>
              <Td>
                {`${dep.spec?.replicas ?? 0} desired, ${dep.status?.updatedReplicas ?? 0} updated, ${
                  dep.status?.replicas ?? 0
                } total, ${dep.status?.availableReplicas ?? 0} available, ${
                  dep.status?.unavailableReplicas ?? 0
                } unavailable`}
              </Td>
            </Tr>

            <TableYamlRow
              label="Selector"
              data={dep.spec?.selector?.matchLabels}
              maxWidthClass="lg"
            />

            <Tr>
              <Td>Strategy Type</Td>
              <Td>{dep.spec?.strategy?.type ?? '-'}</Td>
            </Tr>

            <Tr>
              <Td>Status</Td>
              <Td>
                <BadgeStatus status={getDeploymentStatus(dep)} />
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
              headerRight: (i: V1Deployment) => (
                <>
                  <ButtonRestart
                    onClick={() => setConfirmRestartOpen(true)}
                    disabled={deleting || !contextName || updating || patching}
                  />
                  <ButtonScale
                    onClick={() => {
                      setScale(i.spec?.replicas ?? 0);
                      setScaleDialogOpen(true);
                    }}
                    disabled={deleting || !contextName || updating || patching}
                  />
                </>
              ),
              content: (i: V1Deployment) => (
                <>
                  {renderProperties(i)}

                  <ModalDeploymentRestart
                    open={confirmRestartOpen}
                    onOpenChange={setConfirmRestartOpen}
                    deployment={i}
                    patching={patching}
                    onConfirm={handleRestart}
                  />

                  <ModalDeploymentScaleDialog
                    open={scaleDialogOpen}
                    onOpenChange={setScaleDialogOpen}
                    deployment={i}
                    patching={patching}
                    scale={scale}
                    onScaleChange={setScale}
                    onConfirm={handleScaleApply}
                  />
                </>
              ),
            },
          ]
        : [],
    [
      item,
      renderProperties,
      confirmRestartOpen,
      scaleDialogOpen,
      scale,
      deleting,
      contextName,
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
