import type { V1PriorityClass } from '@kubernetes/client-node';
import { Table, Tbody, Td, Tr } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { TableYamlRow } from '@/components/common/TableYamlRow';
import { RightSidebarGeneric } from '../../generic/components/RightSidebarGeneric';

export interface SidebarPriorityClassesProps {
  item: V1PriorityClass | null;
  setItem: (item: V1PriorityClass | null) => void;
  onDelete?: (item: V1PriorityClass) => void;
  onEdit?: (item: V1PriorityClass) => void;
  updating?: boolean;
  deleting?: boolean;
}

function renderOverview(pc: V1PriorityClass) {
  return (
    <div className="space-y-2">
      <Table>
        <Tbody>
          <Tr>
            <Td>Name</Td>
            <Td>{pc.metadata?.name ?? '-'}</Td>
          </Tr>
          <Tr>
            <Td>Age</Td>
            <AgeCell timestamp={pc.metadata?.creationTimestamp ?? ''} />
          </Tr>
          <Tr>
            <Td>Value</Td>
            <Td>{pc.value ?? '-'}</Td>
          </Tr>
          <Tr>
            <Td>Global Default</Td>
            <Td>{pc.globalDefault ? 'Yes' : 'No'}</Td>
          </Tr>
          <Tr>
            <Td>Preemption Policy</Td>
            <Td>{(pc as any).preemptionPolicy ?? '-'}</Td>
          </Tr>
        </Tbody>
      </Table>

      <TableYamlRow label="Labels" data={pc.metadata?.labels} maxWidthClass="lg" />
      <TableYamlRow label="Annotations" data={pc.metadata?.annotations} maxWidthClass="lg" />
    </div>
  );
}

export function SidebarPriorityClasses({
  item,
  setItem,
  onDelete,
  onEdit,
  updating = false,
  deleting = false,
}: SidebarPriorityClassesProps) {
  const sections = item
    ? [
        {
          key: 'properties',
          title: 'Properties',
          content: (i: V1PriorityClass) => renderOverview(i),
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
