import type { V1ClusterRoleBinding } from '@kubernetes/client-node';
import { Table, Tbody, Td, Tr } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { TableYamlRow } from '@/components/common/TableYamlRow';
import { SidebarGeneric } from '../../generic/components/SidebarGeneric';

interface SidebarClusterRoleBindingsProps {
  item: V1ClusterRoleBinding | null;
  setItem: (item: V1ClusterRoleBinding | null) => void;
  onDelete?: (item: V1ClusterRoleBinding) => void;
  onEdit?: (item: V1ClusterRoleBinding) => void;
}

export function SidebarClusterRoleBindings({ item, setItem, onDelete, onEdit }: SidebarClusterRoleBindingsProps) {
  const renderOverview = (rb: V1ClusterRoleBinding) => (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-white/5">
      <Table className="table-fixed">
        <colgroup>
          <col className="w-1/4" />
          <col className="w-3/4" />
        </colgroup>
        <Tbody>
          <Tr>
            <Td>Name</Td>
            <Td className="break-all text-white">{rb.metadata?.name ?? '-'}</Td>
          </Tr>

          <Tr>
            <Td>Age</Td>
            <AgeCell timestamp={rb.metadata?.creationTimestamp ?? ''} />
          </Tr>

          <Tr>
            <Td>Subjects</Td>
            <Td>{(rb.subjects || []).length}</Td>
          </Tr>

          <Tr>
            <Td>Role Ref</Td>
            <Td>{rb.roleRef?.name ?? '-'}</Td>
          </Tr>

          <TableYamlRow label="Labels" data={rb.metadata?.labels} maxWidthClass="lg" />
          <TableYamlRow label="Annotations" data={rb.metadata?.annotations} maxWidthClass="xl" />
          <TableYamlRow label="Subjects" data={rb.subjects} maxWidthClass="xl" />
          <TableYamlRow label="RoleRef" data={rb.roleRef} maxWidthClass="xl" />
        </Tbody>
      </Table>
    </div>
  );

  const sections = item
    ? [
        {
          key: 'properties',
          title: 'Properties',
          content: (i: V1ClusterRoleBinding) => renderOverview(i),
        },
      ]
    : [];

  return (
    <SidebarGeneric item={item} setItem={setItem} sections={sections} onDelete={onDelete} onEdit={onEdit} />
  );
}