import type { V1ReplicationController } from '@kubernetes/client-node';
import { Table, Tbody, Td, Tr } from '@/components/ui/table';
import { useCallback, useMemo } from 'react';
import AgeCell from '@/components/common/AgeCell';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import { TableYamlRow } from '@/components/common/TableYamlRow';
import { RightSidebarGeneric } from '../../generic/components/RightSidebarGeneric';
import { BadgeStatus } from '../../generic/components/BadgeStatus';
import { getReplicationControllerStatus } from '../utils/replicationControllerStatus';

interface SidebarReplicationControllersProps {
  item: V1ReplicationController | null;
  setItem: (item: V1ReplicationController | null) => void;
  onDelete?: (item: V1ReplicationController) => void;
  onEdit?: (item: V1ReplicationController) => void;
  updating?: boolean;
  deleting?: boolean;
}

export function SidebarReplicationControllers({
  item,
  setItem,
  onDelete,
  onEdit,
  updating = false,
  deleting = false,
}: SidebarReplicationControllersProps) {
  const renderOverview = useCallback(
    (rc: V1ReplicationController) => (
      <div className="overflow-hidden rounded-lg border border-white/10 bg-white/5">
        <Table className="table-fixed">
          <colgroup>
            <col className="w-1/4" />
            <col className="w-3/4" />
          </colgroup>
          <Tbody>
            <Tr>
              <Td>Name</Td>
              <Td className="break-all text-white">{rc.metadata?.name ?? '-'}</Td>
            </Tr>

            <Tr>
              <Td>Namespace</Td>
              <Td>
                <BadgeNamespaces name={rc.metadata?.namespace ?? ''} />
              </Td>
            </Tr>

            <Tr>
              <Td>Age</Td>
              <AgeCell timestamp={rc.metadata?.creationTimestamp ?? ''} />
            </Tr>

            <TableYamlRow label="Labels" data={rc.metadata?.labels} maxWidthClass="lg" />
            <TableYamlRow label="Annotations" data={rc.metadata?.annotations} maxWidthClass="xl" />

            <Tr>
              <Td>Replicas</Td>
              <Td>{rc.spec?.replicas ?? '-'}</Td>
            </Tr>

            <Tr>
              <Td>Status</Td>
              <Td>
                <BadgeStatus status={getReplicationControllerStatus(rc)} />
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
              content: (i: V1ReplicationController) => renderOverview(i),
            },
          ]
        : [],
    [item, renderOverview]
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
    />
  );
}
