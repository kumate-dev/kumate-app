import type { V1PriorityClass } from '@kubernetes/client-node';
import { Table, Tbody, Td, Tr } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { TableYamlRow } from '@/components/common/TableYamlRow';
import { SidebarGeneric } from '../../generic/components/SidebarGeneric';

export interface SidebarPriorityClassesProps {
  item: V1PriorityClass | null;
  setItem: (item: V1PriorityClass | null) => void;
  onDelete?: (item: V1PriorityClass) => void;
  onEdit?: (item: V1PriorityClass) => void;
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

      <TableYamlRow data={pc.metadata?.labels} title="Labels" maxWidthClass="lg" />
      <TableYamlRow data={pc.metadata?.annotations} title="Annotations" maxWidthClass="lg" />
    </div>
  );
}

export function SidebarPriorityClasses({
  item,
  setItem,
  onDelete,
  onEdit,
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
    <SidebarGeneric
      item={item}
      setItem={setItem}
      sections={sections}
      onDelete={onDelete}
      onEdit={onEdit}
    />
  );
}
