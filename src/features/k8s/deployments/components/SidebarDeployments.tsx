import type { V1Deployment } from '@kubernetes/client-node';
import { Table, Tbody, Td, Tr } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import { TableYamlRow } from '@/components/common/TableYamlRow';
import { SidebarGeneric } from '../../generic/components/SidebarGeneric';
import { BadgeStatus } from '../../generic/components/BadgeStatus';
import { getDeploymentStatus } from '../utils/deploymentStatus';

interface SidebarDeploymentsProps {
  item: V1Deployment | null;
  setItem: (item: V1Deployment | null) => void;
  onDelete?: (item: V1Deployment) => void;
  onEdit?: (item: V1Deployment) => void;
}

export function SidebarK8sDeployments({
  item,
  setItem,
  onDelete,
  onEdit,
}: SidebarDeploymentsProps) {
  const renderOverview = (dep: V1Deployment) => (
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

          <TableYamlRow label="Labels" data={dep.metadata?.labels} />
          <TableYamlRow label="Annotations" data={dep.metadata?.annotations} />

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

          <TableYamlRow label="Selector" data={dep.spec?.selector?.matchLabels} />

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
  );

  const sections = item
    ? [
        {
          key: 'properties',
          title: 'Properties',
          content: (i: V1Deployment) => renderOverview(i),
        },
      ]
    : [];

  return (
    <SidebarGeneric
      item={item}
      setItem={setItem}
      sections={sections}
      onDelete={onDelete}
      onEdit={onEdit}
    />
  );
}
