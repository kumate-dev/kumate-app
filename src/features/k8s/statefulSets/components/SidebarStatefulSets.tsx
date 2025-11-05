import type { V1StatefulSet } from '@kubernetes/client-node';
import { Table, Tbody, Td, Tr } from '@/components/ui/table';
import AgeCell from '@/components/common/AgeCell';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import { TableYamlRow } from '@/components/common/TableYamlRow';
import { SidebarGeneric } from '../../generic/components/SidebarGeneric';
import { BadgeStatus } from '../../generic/components/BadgeStatus';
import { getStatefulSetStatus } from '../utils/statefulSetStatus';

interface SidebarStatefulSetsProps {
  item: V1StatefulSet | null;
  setItem: (item: V1StatefulSet | null) => void;
  onDelete?: (item: V1StatefulSet) => void;
  onEdit?: (item: V1StatefulSet) => void;
}

export function SidebarStatefulSets({ item, setItem, onDelete, onEdit }: SidebarStatefulSetsProps) {
  const renderOverview = (ss: V1StatefulSet) => (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-white/5">
      <Table className="table-fixed">
        <colgroup>
          <col className="w-1/4" />
          <col className="w-3/4" />
        </colgroup>
        <Tbody>
          <Tr>
            <Td>Name</Td>
            <Td className="break-all text-white">{ss.metadata?.name ?? '-'}</Td>
          </Tr>

          <Tr>
            <Td>Namespace</Td>
            <Td>
              <BadgeNamespaces name={ss.metadata?.namespace ?? ''} />
            </Td>
          </Tr>

          <Tr>
            <Td>Age</Td>
            <AgeCell timestamp={ss.metadata?.creationTimestamp ?? ''} />
          </Tr>

          <TableYamlRow label="Labels" data={ss.metadata?.labels} maxWidthClass="lg" />
          <TableYamlRow label="Annotations" data={ss.metadata?.annotations} maxWidthClass="xl" />

          <Tr>
            <Td>Replicas</Td>
            <Td>{ss.spec?.replicas ?? 0}</Td>
          </Tr>

          <Tr>
            <Td>Update Strategy</Td>
            <Td>{ss.spec?.updateStrategy?.type ?? '-'}</Td>
          </Tr>

          <Tr>
            <Td>Status</Td>
            <Td>
              <BadgeStatus status={getStatefulSetStatus(ss)} />
            </Td>
          </Tr>
        </Tbody>
      </Table>
    </div>
  );

  const sections = item
    ? [
        {
          key: 'properties',
          title: 'Properties',
          content: (i: V1StatefulSet) => renderOverview(i),
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
