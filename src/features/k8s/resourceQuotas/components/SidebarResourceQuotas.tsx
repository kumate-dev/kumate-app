import type { V1ResourceQuota } from '@kubernetes/client-node';
import { Table, Tbody, Td, Tr } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { TableYamlRow } from '@/components/common/TableYamlRow';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import { RightSidebarGeneric } from '../../generic/components/RightSidebarGeneric';

interface SidebarResourceQuotasProps {
  item: V1ResourceQuota | null;
  setItem: (item: V1ResourceQuota | null) => void;
  onDelete?: (item: V1ResourceQuota) => void;
  onEdit?: (item: V1ResourceQuota) => void;
  updating?: boolean;
  deleting?: boolean;
}

function renderOverview(rq: V1ResourceQuota) {
  const hard = rq.status?.hard as Record<string, string | number | undefined> | undefined;
  const used = rq.status?.used as Record<string, string | number | undefined> | undefined;

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border border-white/10 bg-white/5">
        <Table className="table-fixed">
          <colgroup>
            <col className="w-1/4" />
            <col className="w-3/4" />
          </colgroup>
          <Tbody>
            <Tr>
              <Td>Name</Td>
              <Td className="break-all text-white">{rq.metadata?.name ?? '-'}</Td>
            </Tr>
            <Tr>
              <Td>Namespace</Td>
              <Td>
                <BadgeNamespaces name={rq.metadata?.namespace ?? ''} />
              </Td>
            </Tr>
            <Tr>
              <Td>Age</Td>
              <AgeCell timestamp={rq.metadata?.creationTimestamp ?? ''} />
            </Tr>
            <TableYamlRow label="Labels" data={rq.metadata?.labels} maxWidthClass="lg" />
            <TableYamlRow label="Annotations" data={rq.metadata?.annotations} maxWidthClass="lg" />
          </Tbody>
        </Table>
      </div>

      <div className="overflow-hidden rounded-lg border border-white/10 bg-white/5">
        <div className="p-4">
          <div className="font-medium text-white">Hard</div>
          <div className="mt-2">
            <TableYamlRow label="" data={hard} maxWidthClass="lg" />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-white/10 bg-white/5">
        <div className="p-4">
          <div className="font-medium text-white">Used</div>
          <div className="mt-2">
            <TableYamlRow label="" data={used} maxWidthClass="lg" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function SidebarResourceQuotas({
  item,
  setItem,
  onDelete,
  onEdit,
  updating = false,
  deleting = false,
}: SidebarResourceQuotasProps) {
  const sections = item
    ? [
        {
          key: 'properties',
          title: 'Properties',
          content: (i: V1ResourceQuota) => renderOverview(i),
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
