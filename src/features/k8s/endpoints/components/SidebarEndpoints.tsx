import type { V1Endpoints } from '@kubernetes/client-node';
import { Table, Tbody, Td, Tr } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import { TableYamlRow } from '@/components/common/TableYamlRow';
import { RightSidebarGeneric } from '../../generic/components/RightSidebarGeneric';

export interface SidebarEndpointsProps {
  item: V1Endpoints;
  setItem: (item: V1Endpoints | null) => void;
  onDelete?: (item: V1Endpoints) => void;
  onEdit?: (item: V1Endpoints) => void;
  updating?: boolean;
  deleting?: boolean;
}

export function SidebarEndpoints({
  item,
  setItem,
  onDelete,
  onEdit,
  updating = false,
  deleting = false,
}: SidebarEndpointsProps) {
  const renderOverview = (ep: V1Endpoints) => {
    const subsetsCount = (ep.subsets || []).length;
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
              <Td className="break-all text-white">{ep.metadata?.name ?? '-'}</Td>
            </Tr>
            <Tr>
              <Td>Namespace</Td>
              <Td>
                <BadgeNamespaces name={ep.metadata?.namespace ?? ''} />
              </Td>
            </Tr>
            <Tr>
              <Td>Age</Td>
              <AgeCell timestamp={ep.metadata?.creationTimestamp ?? ''} />
            </Tr>
            <Tr>
              <Td>Subsets</Td>
              <Td className="break-all text-white">{subsetsCount}</Td>
            </Tr>
            <TableYamlRow label="Labels" data={ep.metadata?.labels} maxWidthClass="lg" />
            <TableYamlRow label="Annotations" data={ep.metadata?.annotations} maxWidthClass="lg" />
            <TableYamlRow label="Subsets" data={ep.subsets} maxWidthClass="xl" />
          </Tbody>
        </Table>
      </div>
    );
  };

  return (
    <RightSidebarGeneric
      item={item}
      setItem={setItem}
      onDelete={onDelete}
      onEdit={onEdit}
      sections={[{ key: 'properties', title: 'Properties', content: renderOverview }]}
      updating={updating}
      deleting={deleting}
    />
  );
}

export default SidebarEndpoints;
