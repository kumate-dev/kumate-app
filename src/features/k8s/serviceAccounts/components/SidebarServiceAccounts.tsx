import type { V1ServiceAccount } from '@kubernetes/client-node';
import { Table, Tbody, Td, Tr } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import { TableYamlRow } from '@/components/common/TableYamlRow';
import { SidebarGeneric } from '../../generic/components/SidebarGeneric';

interface SidebarServiceAccountsProps {
  item: V1ServiceAccount | null;
  setItem: (item: V1ServiceAccount | null) => void;
  onDelete?: (item: V1ServiceAccount) => void;
  onEdit?: (item: V1ServiceAccount) => void;
}

export function SidebarServiceAccounts({ item, setItem, onDelete, onEdit }: SidebarServiceAccountsProps) {
  const renderOverview = (sa: V1ServiceAccount) => (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-white/5">
      <Table className="table-fixed">
        <colgroup>
          <col className="w-1/4" />
          <col className="w-3/4" />
        </colgroup>
        <Tbody>
          <Tr>
            <Td>Name</Td>
            <Td className="break-all text-white">{sa.metadata?.name ?? '-'}</Td>
          </Tr>

          <Tr>
            <Td>Namespace</Td>
            <Td>
              <BadgeNamespaces name={sa.metadata?.namespace ?? ''} />
            </Td>
          </Tr>

          <Tr>
            <Td>Age</Td>
            <AgeCell timestamp={sa.metadata?.creationTimestamp ?? ''} />
          </Tr>

          <Tr>
            <Td>Secrets</Td>
            <Td>{sa.secrets?.length ?? 0}</Td>
          </Tr>

          <TableYamlRow label="Labels" data={sa.metadata?.labels} maxWidthClass="lg" />
          <TableYamlRow label="Annotations" data={sa.metadata?.annotations} maxWidthClass="xl" />
          <TableYamlRow label="Secrets" data={sa.secrets} maxWidthClass="xl" />
          <TableYamlRow label="Image Pull Secrets" data={sa.imagePullSecrets} maxWidthClass="xl" />
        </Tbody>
      </Table>
    </div>
  );

  const sections = item
    ? [
        {
          key: 'properties',
          title: 'Properties',
          content: (i: V1ServiceAccount) => renderOverview(i),
        },
      ]
    : [];

  return (
    <SidebarGeneric item={item} setItem={setItem} sections={sections} onDelete={onDelete} onEdit={onEdit} />
  );
}