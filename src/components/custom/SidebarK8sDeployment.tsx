import { DeploymentItem } from '@/services/deployments';
import { Badge } from '@/components/ui/badge';
import AgeCell from '@/components/custom/AgeCell';
import { SidebarK8sResources } from './SidebarK8sResources';
import { k8sDeploymentStatusVariant } from '@/constants/variant';
import { Table, Tbody, Td, Tr } from '@/components/ui/table';
import { TableYamlRow } from './TableYamlRow';

interface SidebarDeploymentProps {
  item: DeploymentItem | null;
  setItem: (item: DeploymentItem | null) => void;
  onDelete?: (item: DeploymentItem) => void;
}

export function SidebarK8sDeployment({ item, setItem, onDelete }: SidebarDeploymentProps) {
  const renderOverview = (i: DeploymentItem) => (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-white/5">
      <Table>
        <Tbody>
          <Tr>
            <Td className="w-1/4 text-white/70">Name</Td>
            <Td className="break-all text-white">{i.name}</Td>
          </Tr>

          <Tr>
            <Td className="text-white/70">Age</Td>
            <Td>
              <AgeCell timestamp={i.creation_timestamp || ''} />
            </Td>
          </Tr>

          <Tr>
            <Td className="text-white/70">Namespace</Td>
            <Td>{i.namespace}</Td>
          </Tr>

          <TableYamlRow label="Labels" data={i.labels} />

          <TableYamlRow label="Annotations" data={i.annotations} />

          <Tr>
            <Td className="text-white/70">Replicas</Td>
            <Td>{i.replicas ?? '-'}</Td>
          </Tr>
          
          <TableYamlRow label="Selector" data={i.selector} />

          <Tr>
            <Td className="text-white/70">Strategy Type</Td>
            <Td>{i.strategy_type ?? '-'}</Td>
          </Tr>

          <Tr>
            <Td className="text-white/70">Status</Td>
            <Td>
              <Badge variant={k8sDeploymentStatusVariant(i.status || '')}>{i.status}</Badge>
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
          content: (i: DeploymentItem) => renderOverview(i),
        },
      ]
    : [];

  return (
    <SidebarK8sResources item={item} setItem={setItem} sections={sections} onDelete={onDelete} />
  );
}