import type { V1CronJob } from '@kubernetes/client-node';
import { Table, Tbody, Td, Tr } from '@/components/ui/table';
import { useCallback, useMemo, useState } from 'react';
import AgeCell from '@/components/common/AgeCell';
import { BadgeNamespaces } from '../../generic/components/BadgeNamespaces';
import { TableYamlRow } from '@/components/common/TableYamlRow';
import { RightSidebarGeneric } from '../../generic/components/RightSidebarGeneric';
import { BadgeStatus } from '../../generic/components/BadgeStatus';
import { getCronJobStatus } from '../utils/cronJobStatus';
import { ButtonTrigger } from '@/components/common/ButtonTrigger';
import { ButtonSuspend } from '@/components/common/ButtonSuspend';
import { toast } from 'sonner';
import type { V1Job } from '@kubernetes/client-node';
import { createJob } from '@/api/k8s/jobs';
import { suspendCronJob } from '@/api/k8s/cronJobs';

interface SidebarCronJobsProps {
  item: V1CronJob | null;
  setItem: (item: V1CronJob | null) => void;
  onDelete?: (item: V1CronJob) => void;
  onEdit?: (item: V1CronJob) => void;
  contextName?: string;
  updating?: boolean;
  deleting?: boolean;
}

export function SidebarCronJobs({
  item,
  setItem,
  onDelete,
  onEdit,
  contextName,
  updating = false,
  deleting = false,
}: SidebarCronJobsProps) {
  const [patching, setPatching] = useState(false);

  const handleTrigger = useCallback(
    async (cj: V1CronJob) => {
      if (!contextName) return;
      const namespace = cj.metadata?.namespace || 'default';
      const jobSpec = cj.spec?.jobTemplate?.spec;
      if (!jobSpec) {
        toast.error('jobTemplate.spec is missing');
        return;
      }
      const jobName = `${cj.metadata?.name || 'cronjob'}-manual-${Date.now()}`;
      const manifest: V1Job = {
        apiVersion: 'batch/v1',
        kind: 'Job',
        metadata: {
          name: jobName,
          namespace,
          labels: cj.metadata?.labels,
        },
        spec: jobSpec,
      };
      try {
        await createJob({ name: contextName, namespace, manifest });
        toast.success('CronJob triggered: Job created');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        toast.error(`Trigger failed: ${msg}`);
      }
    },
    [contextName]
  );

  const handleToggleSuspend = useCallback(
    async (cj: V1CronJob) => {
      if (!contextName || !cj.metadata?.name) return;
      setPatching(true);
      const next = !(cj.spec?.suspend === true);
      try {
        await suspendCronJob({
          name: contextName,
          namespace: cj.metadata?.namespace,
          resourceName: cj.metadata.name,
          suspend: next,
        });
        toast.success(next ? 'CronJob suspended' : 'CronJob resumed');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        toast.error(`Suspend/resume failed: ${msg}`);
      } finally {
        setPatching(false);
      }
    },
    [contextName]
  );
  
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
              headerRight: (i: V1CronJob) => (
                <>
                  <ButtonTrigger
                    onClick={() => handleTrigger(i)}
                    disabled={deleting || updating || patching || !contextName}
                  />
                  <ButtonSuspend
                    onClick={() => handleToggleSuspend(i)}
                    isSuspended={i.spec?.suspend === true}
                    disabled={deleting || updating || patching || !contextName}
                    loading={patching}
                  />
                </>
              ),
            },
          ]
        : [],
    [item, renderProperties, deleting, updating, patching, contextName, handleTrigger, handleToggleSuspend]
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
