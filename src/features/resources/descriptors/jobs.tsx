/**
 * Jobs.
 *
 * The status column is the reason this file has a Status section rather than one
 * expression. `utils/jobStatus.ts` derived the state from three counters and got it wrong
 * in three ways:
 *
 * - **`failed > 0` meant `Failed`.** It does not. A Job retries a failed pod up to
 *   `spec.backoffLimit` times — six by default — so one flaky pod out of six permitted
 *   retries marked a perfectly healthy, still-running Job as failed, in red, permanently:
 *   `status.failed` is cumulative and never goes back down, so the Job stayed red even
 *   after it completed successfully.
 * - **`spec.suspend` was ignored.** A suspended Job has no active pods and no successes,
 *   so it fell through to the last branch and read `Pending` — indistinguishable from a
 *   Job waiting to be scheduled.
 * - **`status.conditions` was never read**, which is where the Job controller records the
 *   only authoritative answers. `Failed=True` carries the reason (`BackoffLimitExceeded`,
 *   `DeadlineExceeded`, `FailedIndexes`) that says which of the many ways a Job can die
 *   this one died of.
 *
 * The order below follows the Job controller: conditions win over counters, because the
 * controller has already made the decision the counters only hint at.
 */

import { For, Show } from 'solid-js';
import { ListChecks } from 'lucide-solid';
import type { V1Container, V1Job, V1OwnerReference } from '@kubernetes/client-node';

import { deleteJobs, listJobs, updateJob, watchJobs } from '@/api/k8s/jobs';
import { formatAge } from '@/lib/k8s';
import { useClock } from '@/stores/clock';
import type { K8sStatus } from '@/types/k8sStatus';
import { StatusBadge } from '@/ui/StatusBadge';

import {
  AgeCell,
  ConditionsTable,
  DetailGrid,
  DetailRow,
  LabelList,
  ageValue,
} from '../detail-parts';
import { defineResource } from '../types';

/* -------------------------------------------------------------------------- */
/* Status                                                                     */
/* -------------------------------------------------------------------------- */

interface ConditionHit {
  status: string;
  reason?: string;
}

/**
 * The condition of the given type, or `undefined`.
 *
 * A loop rather than `find`, and one pass rather than a `conditionStatus` /
 * `conditionReason` pair: this runs per row per sort.
 */
const condition = (job: V1Job, type: string): ConditionHit | undefined => {
  const conditions = job.status?.conditions;
  if (!conditions) return undefined;
  for (const candidate of conditions) {
    if (candidate.type === type) return candidate;
  }
  return undefined;
};

/**
 * How many successful pods finish this Job.
 *
 * `spec.completions` unset means the Job is done as soon as *any* pod succeeds, however
 * many run in parallel — so the denominator is 1, not `parallelism` and not 0. The React
 * helper compared against 0 here and reached the `succeeded > 0` fallback, which happened
 * to give the right answer for a finished Job and the wrong one for a running one.
 */
const requiredCompletions = (job: V1Job): number => job.spec?.completions ?? 1;

export const getJobStatus = (job: V1Job): K8sStatus => {
  const failed = condition(job, 'Failed');
  if (failed?.status === 'True') {
    return { status: failed.reason ?? 'Failed', variant: 'error' };
  }

  const complete = condition(job, 'Complete');
  if (complete?.status === 'True') return { status: 'Complete', variant: 'success' };

  // `Suspended` is a condition *and* a spec field; either is enough. The spec field is
  // what the user set, so a Job that has just been suspended reads as suspended before the
  // controller has acknowledged it.
  if (job.spec?.suspend === true || condition(job, 'Suspended')?.status === 'True') {
    return { status: 'Suspended', variant: 'secondary' };
  }

  const status = job.status;

  // Ahead of the conditions being observed: a Job that reached its completion count is
  // complete, and the badge should not lag the numbers in the column beside it.
  if ((status?.succeeded ?? 0) >= requiredCompletions(job)) {
    return { status: 'Complete', variant: 'success' };
  }

  // `warning` for work in progress, matching Pods (`ContainerCreating`) and Deployments
  // (`Progressing`) — not an error, not a success.
  if ((status?.active ?? 0) > 0) return { status: 'Running', variant: 'warning' };

  // No active pods, nothing succeeded, something failed, and no `Failed` condition yet:
  // the controller is between retries or about to give up. This is the only case where the
  // React behaviour was right.
  if ((status?.failed ?? 0) > 0) return { status: 'Failed', variant: 'error' };

  return { status: 'Pending', variant: 'default' };
};

/* -------------------------------------------------------------------------- */
/* Duration                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Epoch milliseconds for a timestamp that arrives as a string over IPC but is typed as a
 * `Date` by the generated client. Zero for absent, which is how `ageValue` reads a missing
 * `creationTimestamp` too.
 */
const timeValue = (timestamp?: Date | string): number => {
  if (!timestamp) return 0;
  return typeof timestamp === 'string' ? Date.parse(timestamp) : timestamp.getTime();
};

interface JobDurationProps {
  job: V1Job;
}

/**
 * How long the Job has been running, or how long it took.
 *
 * Two things worth noting:
 *
 * - `formatAge` is a difference formatter, not a clock reader — passing the completion
 *   time as its `now` gives the elapsed span in the same units the Age column uses.
 * - `now()` is read **only** when the Job has no completion time. Solid tracks the read,
 *   not the component, so a finished Job's cell is not re-evaluated on the clock tick even
 *   though the shared clock is subscribed here. There is no timer in this cell and there
 *   must never be one — see `stores/clock.ts`.
 */
function JobDuration(props: JobDurationProps) {
  const now = useClock();
  const end = () => timeValue(props.job.status?.completionTime) || now();

  return (
    <Show
      when={props.job.status?.startTime}
      fallback={<span class="text-[var(--text-tertiary)]">—</span>}
    >
      {(start) => <span class="tnum">{formatAge(start(), end())}</span>}
    </Show>
  );
}

/**
 * Sort value for the duration column.
 *
 * `Date.now()` is read once per call rather than from the shared clock, because the column
 * contract wants a plain cheap number and a running Job's duration only has to be right
 * relative to its neighbours in the same sort pass.
 */
const durationValue = (job: V1Job): number => {
  const start = timeValue(job.status?.startTime);
  if (start === 0) return 0;
  return (timeValue(job.status?.completionTime) || Date.now()) - start;
};

/* -------------------------------------------------------------------------- */
/* Detail helpers                                                             */
/* -------------------------------------------------------------------------- */

const ownerSummary = (owners?: V1OwnerReference[]): string | undefined =>
  owners?.map((owner) => `${owner.kind}/${owner.name}`).join(', ');

const quantitySummary = (quantities?: { [key: string]: string }): string | undefined => {
  const entries = Object.entries(quantities ?? {});
  if (entries.length === 0) return undefined;
  return entries.map(([key, value]) => `${key} ${value}`).join(' · ');
};

const portSummary = (container: V1Container): string | undefined => {
  const ports = container.ports ?? [];
  if (ports.length === 0) return undefined;
  return ports.map((port) => `${port.containerPort}/${port.protocol ?? 'TCP'}`).join(', ');
};

const volumeNames = (job: V1Job): string | undefined => {
  const volumes = job.spec?.template.spec?.volumes;
  if (!volumes || volumes.length === 0) return undefined;
  return volumes.map((volume) => volume.name).join(', ');
};

/* -------------------------------------------------------------------------- */
/* Descriptor                                                                 */
/* -------------------------------------------------------------------------- */

export const jobsDescriptor = defineResource({
  id: 'jobs',
  kind: 'Job',
  title: 'Jobs',
  group: 'workloads',
  icon: ListChecks,
  namespaced: true,

  api: {
    list: listJobs,
    watch: watchJobs,
    remove: deleteJobs,
    update: updateJob,
  },

  status: getJobStatus,

  // Newest first. A Job list is a history: the run someone came here to look at is the one
  // that just finished, not the alphabetically first of two hundred generated names.
  defaultSort: { column: 'age', direction: 'desc' },

  searchExtra: (job: V1Job) => [
    ownerSummary(job.metadata?.ownerReferences),
    ...Object.entries(job.metadata?.labels ?? {}).map(([key, value]) => `${key}=${value}`),
    ...(job.spec?.template.spec?.containers ?? []).map((container) => container.image),
  ],

  columns: [
    {
      id: 'name',
      header: 'Name',
      width: 'minmax(180px, 2.5fr)',
      value: (job: V1Job) => job.metadata?.name,
    },
    {
      id: 'namespace',
      header: 'Namespace',
      width: 'minmax(110px, 1.2fr)',
      value: (job: V1Job) => job.metadata?.namespace,
    },
    {
      id: 'completions',
      header: 'Completions',
      width: '92px',
      // The succeeded count, not the `n/m` string: sorting text puts 10/10 before 2/2.
      value: (job: V1Job) => job.status?.succeeded ?? 0,
      cell: (job: V1Job) => (
        <span class="tnum">
          {job.status?.succeeded ?? 0}/{requiredCompletions(job)}
        </span>
      ),
    },
    {
      id: 'duration',
      header: 'Duration',
      width: '80px',
      align: 'right',
      value: (job: V1Job) => durationValue(job),
      cell: (job: V1Job) => <JobDuration job={job} />,
    },
    {
      id: 'status',
      header: 'Status',
      width: 'minmax(110px, 1.4fr)',
      value: (job: V1Job) => getJobStatus(job).status,
      cell: (job: V1Job) => {
        const status = getJobStatus(job);
        return <StatusBadge status={status.status} variant={status.variant} size="sm" />;
      },
    },
    {
      id: 'age',
      header: 'Age',
      width: '68px',
      align: 'right',
      value: (job: V1Job) => ageValue(job),
      cell: (job: V1Job) => <AgeCell timestamp={job.metadata?.creationTimestamp} />,
    },
  ],

  detail: [
    {
      id: 'metadata',
      title: 'Metadata',
      render: (job: V1Job) => (
        <DetailGrid>
          <DetailRow label="Name">{job.metadata?.name}</DetailRow>
          <DetailRow label="Namespace">{job.metadata?.namespace}</DetailRow>
          {/* For a scheduled run this is the CronJob, and it is the only thing that ties
              `backup-28374920` to anything a human named. */}
          <DetailRow label="Controlled by">{ownerSummary(job.metadata?.ownerReferences)}</DetailRow>
          <DetailRow label="Created">
            <AgeCell timestamp={job.metadata?.creationTimestamp} /> ago
          </DetailRow>
          <DetailRow label="Labels">
            <LabelList entries={job.metadata?.labels} />
          </DetailRow>
          <DetailRow label="Annotations">
            <LabelList entries={job.metadata?.annotations} />
          </DetailRow>
        </DetailGrid>
      ),
    },
    {
      id: 'run',
      title: 'Run',
      render: (job: V1Job) => (
        <DetailGrid>
          <DetailRow label="Status">{getJobStatus(job).status}</DetailRow>
          <DetailRow label="Started">
            <Show when={job.status?.startTime}>
              {(start) => (
                <>
                  <AgeCell timestamp={start()} /> ago
                </>
              )}
            </Show>
          </DetailRow>
          <DetailRow label="Completed">
            <Show when={job.status?.completionTime}>
              {(completion) => (
                <>
                  <AgeCell timestamp={completion()} /> ago
                </>
              )}
            </Show>
          </DetailRow>
          <DetailRow label="Duration">
            <JobDuration job={job} />
          </DetailRow>
          <DetailRow label="Active">{job.status?.active ?? 0}</DetailRow>
          <DetailRow label="Ready">{job.status?.ready ?? 0}</DetailRow>
          <DetailRow label="Succeeded">{job.status?.succeeded ?? 0}</DetailRow>
          <DetailRow
            label="Failed"
            // `status.failed` is cumulative and never decreases, so it is hued only when
            // non-zero — and even then it is amber, not red: failures below
            // `backoffLimit` are retries, not the end of the Job.
            class={(job.status?.failed ?? 0) > 0 ? 'text-[var(--status-warn)]' : undefined}
          >
            {job.status?.failed ?? 0}
          </DetailRow>
          <DetailRow label="Failed indexes">{job.status?.failedIndexes}</DetailRow>
        </DetailGrid>
      ),
    },
    {
      id: 'spec',
      title: 'Parallelism & limits',
      render: (job: V1Job) => (
        <DetailGrid>
          <DetailRow label="Completions">{job.spec?.completions ?? 'Any one pod'}</DetailRow>
          <DetailRow label="Parallelism">{job.spec?.parallelism ?? 1}</DetailRow>
          <DetailRow label="Completion mode">{job.spec?.completionMode}</DetailRow>
          <DetailRow label="Backoff limit">{job.spec?.backoffLimit ?? 6}</DetailRow>
          <DetailRow label="Backoff per index">{job.spec?.backoffLimitPerIndex}</DetailRow>
          <DetailRow label="Deadline">
            <Show when={job.spec?.activeDeadlineSeconds}>{(seconds) => `${seconds()}s`}</Show>
          </DetailRow>
          <DetailRow label="TTL after finish">
            <Show when={job.spec?.ttlSecondsAfterFinished !== undefined}>
              {`${job.spec?.ttlSecondsAfterFinished}s`}
            </Show>
          </DetailRow>
          <DetailRow label="Suspended">{job.spec?.suspend === true ? 'Yes' : 'No'}</DetailRow>
          <DetailRow label="Restart policy">{job.spec?.template.spec?.restartPolicy}</DetailRow>
        </DetailGrid>
      ),
    },
    {
      id: 'template',
      title: 'Pod template',
      render: (job: V1Job) => (
        <div class="flex flex-col gap-2">
          <DetailGrid>
            <DetailRow label="Labels">
              <LabelList entries={job.spec?.template.metadata?.labels} />
            </DetailRow>
            <DetailRow label="Service account">
              {job.spec?.template.spec?.serviceAccountName}
            </DetailRow>
            <DetailRow label="Node selector">
              <LabelList entries={job.spec?.template.spec?.nodeSelector} empty="Any node" />
            </DetailRow>
            <DetailRow label="Volumes">{volumeNames(job)}</DetailRow>
          </DetailGrid>

          <For each={job.spec?.template.spec?.containers}>
            {(container) => (
              <div class="rounded-sm border border-[var(--border-subtle)] bg-[var(--surface-inset)] p-2">
                <div class="selectable mb-1.5 truncate font-medium text-[var(--text-primary)]">
                  {container.name}
                </div>
                <DetailGrid>
                  <DetailRow label="Image">{container.image}</DetailRow>
                  <DetailRow label="Command">{container.command?.join(' ')}</DetailRow>
                  <DetailRow label="Args">{container.args?.join(' ')}</DetailRow>
                  <DetailRow label="Ports">{portSummary(container)}</DetailRow>
                  <DetailRow label="Requests">
                    {quantitySummary(container.resources?.requests)}
                  </DetailRow>
                  <DetailRow label="Limits">
                    {quantitySummary(container.resources?.limits)}
                  </DetailRow>
                </DetailGrid>
              </div>
            )}
          </For>
        </div>
      ),
    },
    {
      id: 'conditions',
      title: 'Conditions',
      render: (job: V1Job) => <ConditionsTable conditions={job.status?.conditions} />,
    },
  ],
});
