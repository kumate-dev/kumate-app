import type { V1RuntimeClass } from '@kubernetes/client-node';
import { Table, Tbody, Td, Tr } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { TableYamlRow } from '@/components/common/TableYamlRow';
import { RightSidebarGeneric } from '../../generic/components/RightSidebarGeneric';

export interface SidebarRuntimeClassesProps {
  item: V1RuntimeClass | null;
  setItem: (item: V1RuntimeClass | null) => void;
  onDelete?: (item: V1RuntimeClass) => void;
  onEdit?: (item: V1RuntimeClass) => void;
  updating?: boolean;
  deleting?: boolean;
}

function renderOverview(rc: V1RuntimeClass) {
  const scheduling = rc.scheduling?.nodeSelector || {};
  const overhead = (rc.overhead as any)?.podFixed || {};
  return (
    <div className="space-y-2">
      <Table>
        <Tbody>
          <Tr>
            <Td>Name</Td>
            <Td>{rc.metadata?.name ?? '-'}</Td>
          </Tr>
          <Tr>
            <Td>Handler</Td>
            <Td>{rc.handler ?? '-'}</Td>
          </Tr>
          <Tr>
            <Td>Age</Td>
            <AgeCell timestamp={rc.metadata?.creationTimestamp ?? ''} />
          </Tr>
        </Tbody>
      </Table>

      <TableYamlRow label="Scheduling nodeSelector" data={scheduling} maxWidthClass="lg" />
      <TableYamlRow label="Overhead podFixed" data={overhead} maxWidthClass="lg" />
      <TableYamlRow label="Labels" data={rc.metadata?.labels} maxWidthClass="lg" />
      <TableYamlRow label="Annotations" data={rc.metadata?.annotations} maxWidthClass="lg" />
    </div>
  );
}

export function SidebarRuntimeClasses({
  item,
  setItem,
  onDelete,
  onEdit,
  updating = false,
  deleting = false,
}: SidebarRuntimeClassesProps) {
  const sections = item
    ? [
        {
          key: 'properties',
          title: 'Properties',
          content: (i: V1RuntimeClass) => renderOverview(i),
        },
      ]
    : [];

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
