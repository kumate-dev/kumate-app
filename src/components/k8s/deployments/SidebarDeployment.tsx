import type { V1Deployment } from '@kubernetes/client-node';
import { Badge } from '@/components/ui/badge';
import { k8sDeploymentStatusVariant } from '@/constants/variant';
import { Table, Tbody, Td, Tr } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { BadgeK8sNamespaces } from '../shared/BadgeNamespaces';
import { TableYamlRow } from '@/components/common/TableYamlRow';
import { SidebarK8sResources } from '../shared/SidebarGeneric';

interface SidebarDeploymentProps {
  item: V1Deployment | null;
  setItem: (item: V1Deployment | null) => void;
  onDelete?: (item: V1Deployment) => void;
  tableRef?: React.RefObject<HTMLTableElement | null>;
}

export function SidebarK8sDeployment({
  item,
  setItem,
  onDelete,
  tableRef,
}: SidebarDeploymentProps) {
  const getStatus = (dep: V1Deployment): string => {
    const available = dep.status?.availableReplicas ?? 0;
    const desired = dep.status?.replicas ?? 0;
    if (desired === 0) return 'Stopped';
    if (available === desired) return 'Running';
    if (available < desired) return 'Updating';
    return 'Unknown';
  };

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
              <BadgeK8sNamespaces name={dep.metadata?.namespace ?? ''} />
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
              <Badge variant={k8sDeploymentStatusVariant(getStatus(dep))}>{getStatus(dep)}</Badge>
            </Td>
          </Tr>
        </Tbody>
      </Table>
    </div>
  );

  const sections = item
    ? [
        {
          key: 'overview',
          title: 'Overview',
          content: (i: V1Deployment) => renderOverview(i),
        },
      ]
    : [];

  return (
    <SidebarK8sResources
      item={item}
      setItem={setItem}
      sections={sections}
      onDelete={onDelete}
      tableRef={tableRef}
    />
  );
}
