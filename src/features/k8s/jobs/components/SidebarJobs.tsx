import type { V1Job } from '@kubernetes/client-node';
import { Table, Tbody, Td, Tr } from '@/components/ui/table';
import { useCallback, useMemo } from 'react';
import AgeCell from '@/components/common/AgeCell';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import { TableYamlRow } from '@/components/common/TableYamlRow';
import { RightSidebarGeneric } from '../../generic/components/RightSidebarGeneric';
import { BadgeStatus } from '../../generic/components/BadgeStatus';
import { getJobStatus } from '../utils/jobStatus';

interface SidebarJobsProps {
  item: V1Job | null;
  setItem: (item: V1Job | null) => void;
  onDelete?: (item: V1Job) => void;
  onEdit?: (item: V1Job) => void;
  updating?: boolean;
  deleting?: boolean;
}

export function SidebarJobs({
  item,
  setItem,
  onDelete,
  onEdit,
  updating = false,
  deleting = false,
}: SidebarJobsProps) {
  const renderOverview = useCallback(
    (job: V1Job) => (
      <div className="overflow-hidden rounded-lg border border-white/10 bg-white/5">
        <Table className="table-fixed">
          <colgroup>
            <col className="w-1/4" />
            <col className="w-3/4" />
          </colgroup>
          <Tbody>
            <Tr>
              <Td>Name</Td>
              <Td className="break-all text-white">{job.metadata?.name ?? '-'}</Td>
            </Tr>

            <Tr>
              <Td>Namespace</Td>
              <Td>
                <BadgeNamespaces name={job.metadata?.namespace ?? ''} />
              </Td>
            </Tr>

            <Tr>
              <Td>Age</Td>
              <AgeCell timestamp={job.metadata?.creationTimestamp ?? ''} />
            </Tr>

            <TableYamlRow label="Labels" data={job.metadata?.labels} maxWidthClass="lg" />
            <TableYamlRow label="Annotations" data={job.metadata?.annotations} maxWidthClass="xl" />

            <Tr>
              <Td>Completions</Td>
              <Td>{job.spec?.completions ?? '-'}</Td>
            </Tr>

            <Tr>
              <Td>Parallelism</Td>
              <Td>{job.spec?.parallelism ?? '-'}</Td>
            </Tr>

            <Tr>
              <Td>Status</Td>
              <Td>
                <BadgeStatus status={getJobStatus(job)} />
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
              content: (i: V1Job) => renderOverview(i),
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
