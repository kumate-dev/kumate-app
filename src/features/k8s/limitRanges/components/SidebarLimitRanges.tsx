import type { V1LimitRange, V1LimitRangeItem } from '@kubernetes/client-node';
import { Table, Tbody, Td, Tr } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { TableYamlRow } from '@/components/common/TableYamlRow';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import { RightSidebarGeneric } from '../../generic/components/RightSidebarGeneric';

interface SidebarLimitRangesProps {
  item: V1LimitRange | null;
  setItem: (item: V1LimitRange | null) => void;
  onDelete?: (item: V1LimitRange) => void;
  onEdit?: (item: V1LimitRange) => void;
}

function renderLimitItem(item?: V1LimitRangeItem) {
  const min = item?.min as Record<string, string | number | undefined> | undefined;
  const max = item?.max as Record<string, string | number | undefined> | undefined;
  const def = (item as any)?._default as Record<string, string | number | undefined> | undefined;
  const defReq = item?.defaultRequest as Record<string, string | number | undefined> | undefined;

  return (
    <div className="space-y-3">
      <div className="text-white/80">Type: {item?.type ?? '-'}</div>
      <TableYamlRow label="Min" data={min} maxWidthClass="lg" />
      <TableYamlRow label="Max" data={max} maxWidthClass="lg" />
      <TableYamlRow label="Default" data={def} maxWidthClass="lg" />
      <TableYamlRow label="Default Request" data={defReq} maxWidthClass="lg" />
    </div>
  );
}

function renderProperties(lr: V1LimitRange) {
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
              <Td className="break-all text-white">{lr.metadata?.name ?? '-'}</Td>
            </Tr>
            <Tr>
              <Td>Namespace</Td>
              <Td>
                <BadgeNamespaces name={lr.metadata?.namespace ?? ''} />
              </Td>
            </Tr>
            <Tr>
              <Td>Age</Td>
              <AgeCell timestamp={lr.metadata?.creationTimestamp ?? ''} />
            </Tr>
            <TableYamlRow label="Labels" data={lr.metadata?.labels} maxWidthClass="lg" />
            <TableYamlRow label="Annotations" data={lr.metadata?.annotations} maxWidthClass="lg" />
          </Tbody>
        </Table>
      </div>

      {(lr.spec?.limits || []).map((l, idx) => (
        <div key={idx} className="overflow-hidden rounded-lg border border-white/10 bg-white/5 p-4">
          {renderLimitItem(l)}
        </div>
      ))}

      {!lr.spec?.limits?.length && (
        <div className="overflow-hidden rounded-lg border border-white/10 bg-white/5 p-4 text-white/60">
          No limits
        </div>
      )}
    </div>
  );
}

export function SidebarLimitRanges({ item, setItem, onDelete, onEdit }: SidebarLimitRangesProps) {
  const sections = item
    ? [{ key: 'properties', title: 'Properties', content: (i: V1LimitRange) => renderProperties(i) }]
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
