import type { V1ReplicaSet } from '@kubernetes/client-node';
import { Table, Tbody, Td, Tr } from '@/components/ui/table';
import { useCallback, useMemo } from 'react';
import AgeCell from '@/components/common/AgeCell';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import { TableYamlRow } from '@/components/common/TableYamlRow';
import { RightSidebarGeneric } from '../../generic/components/RightSidebarGeneric';
import { BadgeStatus } from '../../generic/components/BadgeStatus';
import { getReplicaSetStatus } from '../utils/replicaSetStatus';

interface SidebarReplicaSetsProps {
  item: V1ReplicaSet | null;
  setItem: (item: V1ReplicaSet | null) => void;
  onDelete?: (item: V1ReplicaSet) => void;
  onEdit?: (item: V1ReplicaSet) => void;
  updating?: boolean;
  deleting?: boolean;
}

export function SidebarReplicaSets({
  item,
  setItem,
  onDelete,
  onEdit,
  updating = false,
  deleting = false,
}: SidebarReplicaSetsProps) {
  const renderProperties = useCallback(
    (rs: V1ReplicaSet) => (
      <div className="overflow-hidden rounded-lg border border-white/10 bg-white/5">
        <Table className="table-fixed">
          <colgroup>
            <col className="w-1/4" />
            <col className="w-3/4" />
          </colgroup>
          <Tbody>
            <Tr>
              <Td>Name</Td>
              <Td className="break-all text-white">{rs.metadata?.name ?? '-'}</Td>
            </Tr>

            <Tr>
              <Td>Namespace</Td>
              <Td>
                <BadgeNamespaces name={rs.metadata?.namespace ?? ''} />
              </Td>
            </Tr>

            <Tr>
              <Td>Age</Td>
              <AgeCell timestamp={rs.metadata?.creationTimestamp ?? ''} />
            </Tr>

            <TableYamlRow label="Labels" data={rs.metadata?.labels} maxWidthClass="lg" />
            <TableYamlRow label="Annotations" data={rs.metadata?.annotations} maxWidthClass="xl" />

            <Tr>
              <Td>Replicas</Td>
              <Td>{rs.spec?.replicas ?? '-'}</Td>
            </Tr>

            <Tr>
              <Td>Status</Td>
              <Td>
                <BadgeStatus status={getReplicaSetStatus(rs)} />
              </Td>
            </Tr>
          </Tbody>
        </Table>
      </div>
    ),
    []
  );

  const sections = useMemo(
    () =>
      item
        ? [
            {
              key: 'properties',
              title: 'Properties',
              content: (i: V1ReplicaSet) => renderProperties(i),
            },
          ]
        : [],
    [item, renderProperties, onEdit, onDelete, updating, deleting]
  );

  return (
    <RightSidebarGeneric
      item={item}
      setItem={setItem}
      sections={sections}
      onDelete={onDelete}
      onEdit={onEdit}
      updating={updating}
      deleting={deleting}
      hideFooterActions
    />
  );
}
