import type { V1ConfigMap } from '@kubernetes/client-node';
import { Table, Tbody, Td, Tr } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import { TableYamlRow } from '@/components/common/TableYamlRow';
import { RightSidebarGeneric } from '../../generic/components/RightSidebarGeneric';

interface SidebarConfigMapsProps {
  item: V1ConfigMap | null;
  setItem: (item: V1ConfigMap | null) => void;
  onDelete?: (item: V1ConfigMap) => void;
  onEdit?: (item: V1ConfigMap) => void;
  updating?: boolean;
  deleting?: boolean;
}

export function SidebarConfigMaps({
  item,
  setItem,
  onDelete,
  onEdit,
  updating = false,
  deleting = false,
}: SidebarConfigMapsProps) {
  const renderOverview = (cm: V1ConfigMap) => (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-white/5">
      <Table className="table-fixed">
        <colgroup>
          <col className="w-1/4" />
          <col className="w-3/4" />
        </colgroup>
        <Tbody>
          <Tr>
            <Td>Name</Td>
            <Td className="break-all text-white">{cm.metadata?.name ?? '-'}</Td>
          </Tr>

          <Tr>
            <Td>Age</Td>
            <AgeCell timestamp={cm.metadata?.creationTimestamp ?? ''} />
          </Tr>

          <Tr>
            <Td>Namespace</Td>
            <Td>
              <BadgeNamespaces name={cm.metadata?.namespace ?? ''} />
            </Td>
          </Tr>

          <TableYamlRow label="Labels" data={cm.metadata?.labels} maxWidthClass="lg" />
          <TableYamlRow label="Annotations" data={cm.metadata?.annotations} maxWidthClass="xl" />

          <TableYamlRow label="Data" data={cm.data} maxWidthClass="xl" />
          <TableYamlRow label="Binary Data" data={cm.binaryData} maxWidthClass="xl" />
        </Tbody>
      </Table>
    </div>
  );

  const sections = item
    ? [
        {
          key: 'properties',
          title: 'Properties',
          content: (i: V1ConfigMap) => renderOverview(i),
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
