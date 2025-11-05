import type { V1Lease } from '@kubernetes/client-node';
import { Table, Tbody, Td, Tr } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import { TableYamlRow } from '@/components/common/TableYamlRow';
import { SidebarGeneric } from '../../generic/components/SidebarGeneric';

export interface SidebarLeasesProps {
  item: V1Lease;
  setItem: (item: V1Lease | null) => void;
  onDelete?: (item: V1Lease) => void;
  onEdit?: (item: V1Lease) => void;
}

export function SidebarLeases({ item, setItem, onDelete, onEdit }: SidebarLeasesProps) {
  const renderOverview = (lease: V1Lease) => (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-white/5">
      <Table>
        <Tbody>
          <Tr>
            <Td>Name</Td>
            <Td className="max-w-truncate align-middle">
              <span className="block truncate" title={lease.metadata?.name ?? ''}>
                {lease.metadata?.name}
              </span>
            </Td>
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
        </Tbody>
      </Table>
    </div>
  );

  const renderMetadata = (lease: V1Lease) => (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-lg border border-white/10 bg-white/5">
        <div className="p-4">
          <div className="font-medium text-white">Labels</div>
          <div className="mt-2">
            <TableYamlRow label="Labels" data={lease.metadata?.labels} maxWidthClass="xl" />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-white/10 bg-white/5">
        <div className="p-4">
          <div className="font-medium text-white">Annotations</div>
          <div className="mt-2">
            <TableYamlRow
              label="Annotations"
              data={lease.metadata?.annotations}
              maxWidthClass="xl"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderSpec = (lease: V1Lease) => (
    <div className="space-y-2 overflow-hidden rounded-lg border border-white/10 bg-white/5 p-4">
      <div className="font-medium text-white">Spec</div>
      <div className="mt-2">
        <TableYamlRow label="holderIdentity" data={lease.spec?.holderIdentity} maxWidthClass="xl" />
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
        <TableYamlRow label="renewTime" data={(lease.spec as any)?.renewTime} maxWidthClass="xl" />
        <TableYamlRow
          label="acquireTime"
          data={(lease.spec as any)?.acquireTime}
          maxWidthClass="xl"
        />
      </div>
    </div>
  );

  return (
    <SidebarGeneric
      item={item}
      setItem={setItem}
      onDelete={onDelete}
      onEdit={onEdit}
      sections={[
        { key: 'overview', title: 'Overview', content: renderOverview },
        { key: 'metadata', title: 'Metadata', content: renderMetadata },
        { key: 'spec', title: 'Spec', content: renderSpec },
      ]}
    />
  );
}
