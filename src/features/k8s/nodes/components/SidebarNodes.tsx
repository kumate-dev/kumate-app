import type { V1Node } from '@kubernetes/client-node';
import { Table, Tbody, Td, Tr } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { TableYamlRow } from '@/components/common/TableYamlRow';
import { RightSidebarGeneric } from '../../generic/components/RightSidebarGeneric';
import { BadgeStatus } from '../../generic/components/BadgeStatus';
import { getNodeStatus } from '../utils/nodeStatus';

interface SidebarNodesProps {
  item: V1Node | null;
  setItem: (item: V1Node | null) => void;
  onDelete?: (item: V1Node) => void;
  onEdit?: (item: V1Node) => void;
  contextName?: string;
  deleting?: boolean;
  updating?: boolean;
}

const getNodeRoles = (node: V1Node): string =>
  Object.keys(node.metadata?.labels || {})
    .filter((k) => k.startsWith('node-role.kubernetes.io/'))
    .map((k) => k.replace('node-role.kubernetes.io/', ''))
    .join(', ');

export function SidebarNodes({
  item,
  setItem,
  onDelete,
  onEdit,
  contextName,
  deleting = false,
  updating = false,
}: SidebarNodesProps) {
  const renderProperties = (node: V1Node) => {
    const roles = getNodeRoles(node) || '—';
    const version = node.status?.nodeInfo?.kubeletVersion || '—';

    return (
      <div className="overflow-hidden rounded-lg border border-white/10 bg-white/5">
        <Table className="table-fixed">
          <colgroup>
            <col className="w-1/4" />
            <col className="w-3/4" />
          </colgroup>
          <Tbody>
            <Tr>
              <Td>Name</Td>
              <Td className="break-all text-white">{node.metadata?.name ?? '-'}</Td>
            </Tr>

            <Tr>
              <Td>Age</Td>
              <AgeCell timestamp={node.metadata?.creationTimestamp ?? ''} />
            </Tr>

            <Tr>
              <Td>Roles</Td>
              <Td>{roles}</Td>
            </Tr>

            <Tr>
              <Td>Version</Td>
              <Td>{version}</Td>
            </Tr>

            <Tr>
              <Td>Condition</Td>
              <Td>
                <BadgeStatus status={getNodeStatus(node)} />
              </Td>
            </Tr>

            <TableYamlRow label="Labels" data={node.metadata?.labels} maxWidthClass="lg" />
            <TableYamlRow
              label="Annotations"
              data={node.metadata?.annotations}
              maxWidthClass="xl"
            />
            <TableYamlRow label="Addresses" data={node.status?.addresses} maxWidthClass="xl" />
            <TableYamlRow label="Capacity" data={node.status?.capacity} maxWidthClass="xl" />
            <TableYamlRow label="Allocatable" data={node.status?.allocatable} maxWidthClass="xl" />
            <TableYamlRow label="Taints" data={node.spec?.taints} maxWidthClass="xl" />
            <TableYamlRow label="Conditions" data={node.status?.conditions} maxWidthClass="xl" />
          </Tbody>
        </Table>
      </div>
    );
  };

  const sections = item
    ? [
        {
          key: 'properties',
          title: 'Properties',
          content: (i: V1Node) => renderProperties(i),
        },
      ]
    : [];

  return (
    <RightSidebarGeneric
      item={item}
      setItem={setItem}
      sections={sections}
      eventsProps={
        item
          ? {
              contextName,
              resourceKind: 'Node',
              resourceName: item?.metadata?.name,
            }
          : undefined
      }
      onDelete={onDelete}
      onEdit={onEdit}
      deleting={deleting}
      updating={updating}
    />
  );
}
