import type { V1Namespace } from '@kubernetes/client-node';
import { Table, Tbody, Td, Tr } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { TableYamlRow } from '@/components/common/TableYamlRow';
import { RightSidebarGeneric } from '../../generic/components/RightSidebarGeneric';
import { BadgeStatus } from '../../generic/components/BadgeStatus';
import { getNamespaceStatus } from '../utils/namespaceStatus';

interface SidebarNamespacesProps {
  item: V1Namespace | null;
  setItem: (item: V1Namespace | null) => void;
  onDelete?: (item: V1Namespace) => void;
  onEdit?: (item: V1Namespace) => void;
}

export function SidebarNamespaces({ item, setItem, onDelete, onEdit }: SidebarNamespacesProps) {
  const renderOverview = (ns: V1Namespace) => (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-white/5">
      <Table className="table-fixed">
        <colgroup>
          <col className="w-1/4" />
          <col className="w-3/4" />
        </colgroup>
        <Tbody>
          <Tr>
            <Td>Name</Td>
            <Td className="break-all text-white">{ns.metadata?.name ?? '-'}</Td>
          </Tr>

          <Tr>
            <Td>Age</Td>
            <AgeCell timestamp={ns.metadata?.creationTimestamp ?? ''} />
          </Tr>

          <Tr>
            <Td>Status</Td>
            <Td>
              <BadgeStatus status={getNamespaceStatus(ns)} />
            </Td>
          </Tr>

          <TableYamlRow label="Labels" data={ns.metadata?.labels} maxWidthClass="lg" />
          <TableYamlRow label="Annotations" data={ns.metadata?.annotations} maxWidthClass="xl" />
          <TableYamlRow label="Finalizers" data={ns.spec?.finalizers} maxWidthClass="xl" />
          <TableYamlRow label="Conditions" data={ns.status?.conditions} maxWidthClass="xl" />
        </Tbody>
      </Table>
    </div>
  );

  const sections = item
    ? [
        {
          key: 'properties',
          title: 'Properties',
          content: (i: V1Namespace) => renderOverview(i),
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
    />
  );
}
