import type { V1CronJob } from '@kubernetes/client-node';
import { Table, Tbody, Td, Tr } from '@/components/ui/table';
import { useCallback, useMemo } from 'react';
import AgeCell from '@/components/common/AgeCell';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import { TableYamlRow } from '@/components/common/TableYamlRow';
import { RightSidebarGeneric } from '../../generic/components/RightSidebarGeneric';
import { BadgeStatus } from '../../generic/components/BadgeStatus';
import { getCronJobStatus } from '../utils/cronJobStatus';

interface SidebarCronJobsProps {
  item: V1CronJob | null;
  setItem: (item: V1CronJob | null) => void;
  onDelete?: (item: V1CronJob) => void;
  onEdit?: (item: V1CronJob) => void;
  updating?: boolean;
  deleting?: boolean;
}

export function SidebarCronJobs({
  item,
  setItem,
  onDelete,
  onEdit,
  updating = false,
  deleting = false,
}: SidebarCronJobsProps) {
  const renderProperties = useCallback(
    (cj: V1CronJob) => (
      <div className="overflow-hidden rounded-lg border border-white/10 bg-white/5">
        <Table className="table-fixed">
          <colgroup>
            <col className="w-1/4" />
            <col className="w-3/4" />
          </colgroup>
          <Tbody>
            <Tr>
              <Td>Name</Td>
              <Td className="break-all text-white">{cj.metadata?.name ?? '-'}</Td>
            </Tr>

            <Tr>
              <Td>Namespace</Td>
              <Td>
                <BadgeNamespaces name={cj.metadata?.namespace ?? ''} />
              </Td>
            </Tr>

            <Tr>
              <Td>Age</Td>
              <AgeCell timestamp={cj.metadata?.creationTimestamp ?? ''} />
            </Tr>

            <TableYamlRow label="Labels" data={cj.metadata?.labels} maxWidthClass="lg" />
            <TableYamlRow label="Annotations" data={cj.metadata?.annotations} maxWidthClass="xl" />

            <Tr>
              <Td>Schedule</Td>
              <Td>{cj.spec?.schedule ?? '-'}</Td>
            </Tr>

            <Tr>
              <Td>Concurrency Policy</Td>
              <Td>{cj.spec?.concurrencyPolicy ?? '-'}</Td>
            </Tr>

            <Tr>
              <Td>Last Schedule</Td>
              <AgeCell timestamp={cj.status?.lastScheduleTime ?? ''} />
            </Tr>

            <Tr>
              <Td>Status</Td>
              <Td>
                <BadgeStatus status={getCronJobStatus(cj)} />
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
              content: (i: V1CronJob) => renderProperties(i),
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
