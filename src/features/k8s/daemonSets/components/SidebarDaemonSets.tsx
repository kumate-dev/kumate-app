import type { V1DaemonSet } from '@kubernetes/client-node';
import { Table, Tbody, Td, Tr } from '@/components/ui/table';
import { useCallback, useMemo } from 'react';
import AgeCell from '@/components/common/AgeCell';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import { TableYamlRow } from '@/components/common/TableYamlRow';
import { RightSidebarGeneric } from '../../generic/components/RightSidebarGeneric';
import { BadgeStatus } from '../../generic/components/BadgeStatus';
import { getDaemonSetStatus } from '../utils/daemonSetStatus';

interface SidebarDaemonSetsProps {
  item: V1DaemonSet | null;
  setItem: (item: V1DaemonSet | null) => void;
  onDelete?: (item: V1DaemonSet) => void;
  onEdit?: (item: V1DaemonSet) => void;
  updating?: boolean;
  deleting?: boolean;
}

export function SidebarDaemonSets({
  item,
  setItem,
  onDelete,
  onEdit,
  updating = false,
  deleting = false,
}: SidebarDaemonSetsProps) {
  const renderProperties = useCallback(
    (ds: V1DaemonSet) => (
      <div className="overflow-hidden rounded-lg border border-white/10 bg-white/5">
        <Table className="table-fixed">
          <colgroup>
            <col className="w-1/4" />
            <col className="w-3/4" />
          </colgroup>
          <Tbody>
            <Tr>
              <Td>Name</Td>
              <Td className="break-all text-white">{ds.metadata?.name ?? '-'}</Td>
            </Tr>

            <Tr>
              <Td>Namespace</Td>
              <Td>
                <BadgeNamespaces name={ds.metadata?.namespace ?? ''} />
              </Td>
            </Tr>

            <Tr>
              <Td>Age</Td>
              <AgeCell timestamp={ds.metadata?.creationTimestamp ?? ''} />
            </Tr>

            <TableYamlRow label="Labels" data={ds.metadata?.labels} maxWidthClass="lg" />
            <TableYamlRow label="Annotations" data={ds.metadata?.annotations} maxWidthClass="xl" />

            <Tr>
              <Td>Desired</Td>
              <Td>{ds.status?.desiredNumberScheduled ?? '-'}</Td>
            </Tr>

            <Tr>
              <Td>Ready</Td>
              <Td>{ds.status?.numberReady ?? '-'}</Td>
            </Tr>

            <Tr>
              <Td>Status</Td>
              <Td>
                <BadgeStatus status={getDaemonSetStatus(ds)} />
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
              content: (i: V1DaemonSet) => renderProperties(i),
            },
          ]
        : [],
    [item, renderProperties]
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
