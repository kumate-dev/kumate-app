import type { V1Role } from '@kubernetes/client-node';
import { Table, Tbody, Td, Tr } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import { TableYamlRow } from '@/components/common/TableYamlRow';
import { RightSidebarGeneric } from '../../generic/components/RightSidebarGeneric';

interface SidebarRolesProps {
  item: V1Role | null;
  setItem: (item: V1Role | null) => void;
  onDelete?: (item: V1Role) => void;
  onEdit?: (item: V1Role) => void;
  contextName?: string;
  updating?: boolean;
  deleting?: boolean;
}

export function SidebarRoles({
  item,
  setItem,
  onDelete,
  onEdit,
  contextName,
  updating = false,
  deleting = false,
}: SidebarRolesProps) {
  const renderProperties = (role: V1Role) => (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-white/5">
      <Table className="table-fixed">
        <colgroup>
          <col className="w-1/4" />
          <col className="w-3/4" />
        </colgroup>
        <Tbody>
          <Tr>
            <Td>Name</Td>
            <Td className="break-all text-white">{role.metadata?.name ?? '-'}</Td>
          </Tr>

          <Tr>
            <Td>Namespace</Td>
            <Td>
              <BadgeNamespaces name={role.metadata?.namespace ?? ''} />
            </Td>
          </Tr>

          <Tr>
            <Td>Age</Td>
            <AgeCell timestamp={role.metadata?.creationTimestamp ?? ''} />
          </Tr>

          <Tr>
            <Td>Rules</Td>
            <Td>{(role.rules || []).length}</Td>
          </Tr>

          <TableYamlRow label="Labels" data={role.metadata?.labels} maxWidthClass="lg" />
          <TableYamlRow label="Annotations" data={role.metadata?.annotations} maxWidthClass="xl" />
          <TableYamlRow label="Rules" data={role.rules} maxWidthClass="xl" />
        </Tbody>
      </Table>
    </div>
  );

  const sections = item
    ? [
        {
          key: 'properties',
          title: 'Properties',
          content: (i: V1Role) => renderProperties(i),
        },
      ]
    : [];

  return (
    <RightSidebarGeneric
      item={item}
      setItem={setItem}
      sections={sections}
      eventsProps={item ? {
        contextName,
        resourceKind: 'Role',
        resourceName: item?.metadata?.name,
        namespace: item?.metadata?.namespace,
      } : undefined}
      onDelete={onDelete}
      onEdit={onEdit}
      updating={updating}
      deleting={deleting}
    />
  );
}
