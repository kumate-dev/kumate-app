import type { V1ClusterRole } from '@kubernetes/client-node';
import { Table, Tbody, Td, Tr } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { TableYamlRow } from '@/components/common/TableYamlRow';
import { RightSidebarGeneric } from '../../generic/components/RightSidebarGeneric';

interface SidebarClusterRolesProps {
  item: V1ClusterRole | null;
  setItem: (item: V1ClusterRole | null) => void;
  onDelete?: (item: V1ClusterRole) => void;
  onEdit?: (item: V1ClusterRole) => void;
  contextName?: string;
  updating?: boolean;
  deleting?: boolean;
}

export function SidebarClusterRoles({
  item,
  setItem,
  onDelete,
  onEdit,
  contextName,
  updating,
  deleting,
}: SidebarClusterRolesProps) {
  const renderProperties = (cr: V1ClusterRole) => (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-white/5">
      <Table className="table-fixed">
        <colgroup>
          <col className="w-1/4" />
          <col className="w-3/4" />
        </colgroup>
        <Tbody>
          <Tr>
            <Td>Name</Td>
            <Td className="break-all text-white">{cr.metadata?.name ?? '-'}</Td>
          </Tr>

          <Tr>
            <Td>Age</Td>
            <AgeCell timestamp={cr.metadata?.creationTimestamp ?? ''} />
          </Tr>

          <Tr>
            <Td>Rules</Td>
            <Td>{(cr.rules || []).length}</Td>
          </Tr>

          <TableYamlRow label="Labels" data={cr.metadata?.labels} maxWidthClass="lg" />
          <TableYamlRow label="Annotations" data={cr.metadata?.annotations} maxWidthClass="xl" />
          <TableYamlRow label="Rules" data={cr.rules} maxWidthClass="xl" />
        </Tbody>
      </Table>
    </div>
  );

  const sections = item
    ? [
        {
          key: 'properties',
          title: 'Properties',
          content: (i: V1ClusterRole) => renderProperties(i),
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
              resourceKind: 'ClusterRole',
              resourceName: item?.metadata?.name,
            }
          : undefined
      }
      onDelete={onDelete}
      onEdit={onEdit}
      updating={updating ?? false}
      deleting={deleting ?? false}
    />
  );
}
