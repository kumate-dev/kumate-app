import type { V1ClusterRole } from '@kubernetes/client-node';
import { Table, Tbody, Td, Tr } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { TableYamlRow } from '@/components/common/TableYamlRow';
import { SidebarGeneric } from '../../generic/components/SidebarGeneric';

interface SidebarClusterRolesProps {
  item: V1ClusterRole | null;
  setItem: (item: V1ClusterRole | null) => void;
  onDelete?: (item: V1ClusterRole) => void;
  onEdit?: (item: V1ClusterRole) => void;
}

export function SidebarClusterRoles({ item, setItem, onDelete, onEdit }: SidebarClusterRolesProps) {
  const renderOverview = (cr: V1ClusterRole) => (
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
          content: (i: V1ClusterRole) => renderOverview(i),
        },
      ]
    : [];

  return (
    <SidebarGeneric item={item} setItem={setItem} sections={sections} onDelete={onDelete} onEdit={onEdit} />
  );
}