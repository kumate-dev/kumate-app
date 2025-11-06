import type { V1Lease } from '@kubernetes/client-node';
import { Table, Tbody, Td, Tr } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import { TableYamlRow } from '@/components/common/TableYamlRow';
import { RightSidebarGeneric } from '../../generic/components/RightSidebarGeneric';

export interface SidebarLeasesProps {
  item: V1Lease;
  setItem: (item: V1Lease | null) => void;
  onDelete?: (item: V1Lease) => void;
  onEdit?: (item: V1Lease) => void;
}

export function SidebarLeases({ item, setItem, onDelete, onEdit }: SidebarLeasesProps) {
  const renderProperties = (lease: V1Lease) => (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-white/5">
      <Table className="table-fixed">
        <colgroup>
          <col className="w-1/4" />
          <col className="w-3/4" />
        </colgroup>
        <Tbody>
          <Tr>
            <Td>Name</Td>
            <Td className="break-all text-white">{lease.metadata?.name ?? '-'}</Td>
          </Tr>
          <Tr>
            <Td>Namespace</Td>
            <Td>
              <BadgeNamespaces name={lease.metadata?.namespace ?? ''} />
            </Td>
          </Tr>
          <Tr>
            <Td>Age</Td>
            <AgeCell timestamp={lease.metadata?.creationTimestamp ?? ''} />
          </Tr>

          <TableYamlRow label="Labels" data={lease.metadata?.labels} maxWidthClass="xl" />
          <TableYamlRow label="Annotations" data={lease.metadata?.annotations} maxWidthClass="xl" />

          <TableYamlRow
            label="holderIdentity"
            data={lease.spec?.holderIdentity}
            maxWidthClass="xl"
          />
          <TableYamlRow
            label="leaseDurationSeconds"
            data={
              typeof lease.spec?.leaseDurationSeconds === 'number'
                ? String(lease.spec?.leaseDurationSeconds)
                : lease.spec?.leaseDurationSeconds
            }
            maxWidthClass="xl"
          />
          <TableYamlRow
            label="leaseTransitions"
            data={
              typeof lease.spec?.leaseTransitions === 'number'
                ? String(lease.spec?.leaseTransitions)
                : lease.spec?.leaseTransitions
            }
            maxWidthClass="xl"
          />
          <TableYamlRow
            label="renewTime"
            data={(lease.spec as any)?.renewTime}
            maxWidthClass="xl"
          />
          <TableYamlRow
            label="acquireTime"
            data={(lease.spec as any)?.acquireTime}
            maxWidthClass="xl"
          />
        </Tbody>
      </Table>
    </div>
  );

  const sections = item
    ? [{ key: 'properties', title: 'Properties', content: (i: V1Lease) => renderProperties(i) }]
    : [];

  return (
    <RightSidebarGeneric
      item={item}
      setItem={setItem}
      onDelete={onDelete}
      onEdit={onEdit}
      sections={sections}
    />
  );
}
