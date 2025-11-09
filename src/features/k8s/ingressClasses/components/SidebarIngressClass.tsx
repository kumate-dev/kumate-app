import type { V1IngressClass } from '@kubernetes/client-node';
import { Table, Tbody, Td, Tr } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { TableYamlRow } from '@/components/common/TableYamlRow';
import { RightSidebarGeneric } from '../../generic/components/RightSidebarGeneric';

export interface SidebarIngressClassProps {
  item: V1IngressClass;
  setItem: (item: V1IngressClass | null) => void;
  onDelete?: (item: V1IngressClass) => void;
  onEdit?: (item: V1IngressClass) => void;
  contextName?: string;
  updating?: boolean;
  deleting?: boolean;
}

export function SidebarIngressClass({
  item,
  setItem,
  onDelete,
  onEdit,
  contextName,
  updating = false,
  deleting = false,
}: SidebarIngressClassProps) {
  const renderProperties = (ingc: V1IngressClass) => {
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
              <Td className="break-all text-white">{ingc.metadata?.name ?? '-'}</Td>
            </Tr>
            <Tr>
              <Td>Age</Td>
              <AgeCell timestamp={ingc.metadata?.creationTimestamp ?? ''} />
            </Tr>
            <Tr>
              <Td>Controller</Td>
              <Td className="break-all text-white">{ingc.spec?.controller ?? '-'}</Td>
            </Tr>
            <TableYamlRow label="Parameters" data={ingc.spec?.parameters} maxWidthClass="xl" />
            <TableYamlRow label="Labels" data={ingc.metadata?.labels} maxWidthClass="lg" />
            <TableYamlRow
              label="Annotations"
              data={ingc.metadata?.annotations}
              maxWidthClass="lg"
            />
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
          content: (i: V1IngressClass) => renderProperties(i),
        },
      ]
    : [];

  return (
    <RightSidebarGeneric
      item={item}
      setItem={setItem as any}
      onDelete={onDelete as any}
      onEdit={onEdit as any}
      sections={sections}
      eventsProps={item ? {
        contextName,
        resourceKind: 'IngressClass',
        resourceName: item?.metadata?.name,
      } : undefined}
      updating={updating}
      deleting={deleting}
    />
  );
}

export default SidebarIngressClass;
