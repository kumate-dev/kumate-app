/**
 * CronJobs.
 *
 * `utils/cronJobStatus.ts` had exactly two states, `Suspend` and `Active`, derived from
 * `spec.suspend` alone. Both were wrong in a way that matters:
 *
 * - `Active` is a `status` field on this kind — `status.active` is the list of Jobs running
 *   right now — so using the word for "not suspended" made the badge contradict the Active
 *   column beside it: `Active` with 0 active jobs. The state it was describing is
 *   `Scheduled`.
 * - `Suspend` is a verb. The state is `Suspended`, and it is `secondary`, not `warning`:
 *   suspending a CronJob is a deliberate act, and the warning hue is for things that are
 *   going wrong on their own.
 *
 * Suspend and Resume are one API call with a boolean, and two `ResourceAction`s rather than
 * one that changes its label — an action's `label` is a string, and `available` exists
 * precisely so that a state-dependent action can hide itself.
 */

import { For, Show } from 'solid-js';
import { CalendarClock, Pause, Play } from 'lucide-solid';
import type { V1Container, V1CronJob, V1OwnerReference } from '@kubernetes/client-node';

import {
  deleteCronJobs,
  listCronJobs,
  suspendCronJob,
  updateCronJob,
  watchCronJobs,
} from '@/api/k8s/cronJobs';
import type { K8sStatus } from '@/types/k8sStatus';
import { ConfirmDialog } from '@/ui/Dialog';
import { StatusBadge } from '@/ui/StatusBadge';
import { toast } from '@/ui/Toast';

import { AgeCell, DetailGrid, DetailRow, LabelList, ageValue } from '../detail-parts';
import { openModal } from '../scale-dialog';
import { defineResource } from '../types';

/* -------------------------------------------------------------------------- */
/* Status                                                                     */
/* -------------------------------------------------------------------------- */

const isSuspended = (cronJob: V1CronJob): boolean => cronJob.spec?.suspend === true;

const activeCount = (cronJob: V1CronJob): number => cronJob.status?.active?.length ?? 0;

export const getCronJobStatus = (cronJob: V1CronJob): K8sStatus => {
  if (isSuspended(cronJob)) return { status: 'Suspended', variant: 'secondary' };
  // `warning` for work in progress, matching Pods and Deployments — not an error, not a
  // success.
  if (activeCount(cronJob) > 0) return { status: 'Running', variant: 'warning' };
  return { status: 'Scheduled', variant: 'default' };
};

/* -------------------------------------------------------------------------- */
/* Derived values                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Epoch milliseconds for a timestamp that arrives as a string over IPC but is typed as a
 * `Date` by the generated client. Zero for absent, which is how `ageValue` reads a missing
 * `creationTimestamp` too — a CronJob that has never fired sorts with the oldest.
 */
const timeValue = (timestamp?: Date | string): number => {
  if (!timestamp) return 0;
  return typeof timestamp === 'string' ? Date.parse(timestamp) : timestamp.getTime();
};

const activeNames = (cronJob: V1CronJob): string | undefined => {
  const active = cronJob.status?.active;
  if (!active || active.length === 0) return undefined;
  return active.map((reference) => reference.name ?? '?').join(', ');
};

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

/* -------------------------------------------------------------------------- */
/* Actions                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Confirm a suspend or a resume.
 *
 * Resume gets its own warning because the controller does not simply carry on: on resume it
 * looks for schedules it missed and starts one Job for the most recent, and with more than
 * 100 missed schedules and no `startingDeadlineSeconds` it refuses to schedule at all and
 * only says so in an event. Neither outcome is what someone flipping a toggle expects.
 */
const confirmSuspend = (name: string, suspend: boolean): Promise<boolean> =>
  openModal<boolean>((resolve) => (
    <ConfirmDialog
      open
      onOpenChange={(open) => {
        if (!open) resolve(false);
      }}
      variant="primary"
      title={suspend ? `Suspend ${name}?` : `Resume ${name}?`}
      description={
        suspend
          ? 'No further runs are scheduled. Jobs already running are left alone, and the schedule itself is unchanged.'
          : 'The schedule takes effect again. A run missed while suspended may start immediately.'
      }
      confirmLabel={suspend ? 'Suspend' : 'Resume'}
      onConfirm={() => resolve(true)}
    />
  ));

/* -------------------------------------------------------------------------- */
/* Descriptor                                                                 */
/* -------------------------------------------------------------------------- */

export const cronJobsDescriptor = defineResource({
  id: 'cronJobs',
  kind: 'CronJob',
  title: 'CronJobs',
  group: 'workloads',
  icon: CalendarClock,
  namespaced: true,

  api: {
    list: listCronJobs,
    watch: watchCronJobs,
    remove: deleteCronJobs,
    update: updateCronJob,
  },

  status: getCronJobStatus,

  searchExtra: (cronJob: V1CronJob) => [
    cronJob.spec?.schedule,
    ...Object.entries(cronJob.metadata?.labels ?? {}).map(([key, value]) => `${key}=${value}`),
    ...(cronJob.spec?.jobTemplate.spec?.template.spec?.containers ?? []).map(
      (container) => container.image
    ),
  ],

  columns: [
    {
      id: 'name',
      header: 'Name',
      width: 'minmax(170px, 2.2fr)',
      value: (cronJob: V1CronJob) => cronJob.metadata?.name,
    },
    {
      id: 'namespace',
      header: 'Namespace',
      width: 'minmax(100px, 1.2fr)',
      value: (cronJob: V1CronJob) => cronJob.metadata?.namespace,
    },
    {
      id: 'schedule',
      header: 'Schedule',
      width: 'minmax(100px, 1.2fr)',
      value: (cronJob: V1CronJob) => cronJob.spec?.schedule,
      // Monospaced: a cron expression is five columns, and they only line up down the
      // screen in a fixed-width face.
      class: 'font-mono text-2xs',
    },
    {
      id: 'suspend',
      header: 'Suspend',
      width: '68px',
      value: (cronJob: V1CronJob) => isSuspended(cronJob),
      cell: (cronJob: V1CronJob) => (isSuspended(cronJob) ? 'Yes' : 'No'),
    },
    {
      id: 'active',
      header: 'Active',
      width: '60px',
      align: 'right',
      value: (cronJob: V1CronJob) => activeCount(cronJob),
    },
    {
      id: 'lastSchedule',
      header: 'Last schedule',
      width: '92px',
      align: 'right',
      value: (cronJob: V1CronJob) => timeValue(cronJob.status?.lastScheduleTime),
      cell: (cronJob: V1CronJob) => <AgeCell timestamp={cronJob.status?.lastScheduleTime} />,
    },
    {
      id: 'status',
      header: 'Status',
      width: 'minmax(100px, 1.2fr)',
      value: (cronJob: V1CronJob) => getCronJobStatus(cronJob).status,
      cell: (cronJob: V1CronJob) => {
        const status = getCronJobStatus(cronJob);
        return <StatusBadge status={status.status} variant={status.variant} size="sm" />;
      },
    },
    {
      id: 'age',
      header: 'Age',
      width: '68px',
      align: 'right',
      value: (cronJob: V1CronJob) => ageValue(cronJob),
      cell: (cronJob: V1CronJob) => <AgeCell timestamp={cronJob.metadata?.creationTimestamp} />,
    },
  ],

  detail: [
    {
      id: 'metadata',
      title: 'Metadata',
      render: (cronJob: V1CronJob) => (
        <DetailGrid>
          <DetailRow label="Name">{cronJob.metadata?.name}</DetailRow>
          <DetailRow label="Namespace">{cronJob.metadata?.namespace}</DetailRow>
          <DetailRow label="Created">
            <AgeCell timestamp={cronJob.metadata?.creationTimestamp} /> ago
          </DetailRow>
          <DetailRow label="Controlled by">
            {ownerSummary(cronJob.metadata?.ownerReferences)}
          </DetailRow>
          <DetailRow label="Labels">
            <LabelList entries={cronJob.metadata?.labels} />
          </DetailRow>
          <DetailRow label="Annotations">
            <LabelList entries={cronJob.metadata?.annotations} />
          </DetailRow>
        </DetailGrid>
      ),
    },
    {
      id: 'schedule',
      title: 'Schedule',
      render: (cronJob: V1CronJob) => (
        <DetailGrid>
          <DetailRow label="Schedule">
            <span class="font-mono">{cronJob.spec?.schedule}</span>
          </DetailRow>
          {/* Unset means the *controller's* zone, not the cluster's and not the viewer's,
              which is the usual reason a CronJob appears to fire at the wrong time. */}
          <DetailRow label="Time zone">
            {cronJob.spec?.timeZone ?? 'Controller local time'}
          </DetailRow>
          <DetailRow label="Suspended">{isSuspended(cronJob) ? 'Yes' : 'No'}</DetailRow>
          <DetailRow label="Concurrency">{cronJob.spec?.concurrencyPolicy ?? 'Allow'}</DetailRow>
          <DetailRow label="Starting deadline">
            <Show when={cronJob.spec?.startingDeadlineSeconds}>{(seconds) => `${seconds()}s`}</Show>
          </DetailRow>
          <DetailRow label="Keep succeeded">
            {cronJob.spec?.successfulJobsHistoryLimit ?? 3}
          </DetailRow>
          <DetailRow label="Keep failed">{cronJob.spec?.failedJobsHistoryLimit ?? 1}</DetailRow>
        </DetailGrid>
      ),
    },
    {
      id: 'status',
      title: 'Runs',
      render: (cronJob: V1CronJob) => (
        <DetailGrid>
          <DetailRow label="Last schedule">
            <Show when={cronJob.status?.lastScheduleTime}>
              {(scheduled) => (
                <>
                  <AgeCell timestamp={scheduled()} /> ago
                </>
              )}
            </Show>
          </DetailRow>
          <DetailRow label="Last success">
            <Show when={cronJob.status?.lastSuccessfulTime}>
              {(succeeded) => (
                <>
                  <AgeCell timestamp={succeeded()} /> ago
                </>
              )}
            </Show>
          </DetailRow>
          <DetailRow label="Active">{activeCount(cronJob)}</DetailRow>
          <DetailRow label="Active jobs">{activeNames(cronJob)}</DetailRow>
        </DetailGrid>
      ),
    },
    {
      id: 'template',
      title: 'Job template',
      render: (cronJob: V1CronJob) => (
        <div class="flex flex-col gap-2">
          <DetailGrid>
            <DetailRow label="Completions">
              {cronJob.spec?.jobTemplate.spec?.completions ?? 'Any one pod'}
            </DetailRow>
            <DetailRow label="Parallelism">
              {cronJob.spec?.jobTemplate.spec?.parallelism ?? 1}
            </DetailRow>
            <DetailRow label="Backoff limit">
              {cronJob.spec?.jobTemplate.spec?.backoffLimit ?? 6}
            </DetailRow>
            <DetailRow label="Deadline">
              <Show when={cronJob.spec?.jobTemplate.spec?.activeDeadlineSeconds}>
                {(seconds) => `${seconds()}s`}
              </Show>
            </DetailRow>
            <DetailRow label="Restart policy">
              {cronJob.spec?.jobTemplate.spec?.template.spec?.restartPolicy}
            </DetailRow>
            <DetailRow label="Service account">
              {cronJob.spec?.jobTemplate.spec?.template.spec?.serviceAccountName}
            </DetailRow>
          </DetailGrid>

          <For each={cronJob.spec?.jobTemplate.spec?.template.spec?.containers}>
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
  ],

  actions: [
    {
      id: 'suspend',
      label: 'Suspend',
      icon: Pause,
      multi: false,
      // Hidden rather than disabled when it does not apply: Suspend and Resume are the same
      // toggle, so exactly one of the pair is ever visible.
      available: (items: V1CronJob[]) => {
        const cronJob = items[0];
        return cronJob !== undefined && !isSuspended(cronJob);
      },
      run: async (items: V1CronJob[], ctx) => {
        const cronJob = items[0];
        const name = cronJob?.metadata?.name;
        if (!name) return;

        if (!(await confirmSuspend(name, true))) return;

        await suspendCronJob({
          name: ctx.context,
          namespace: cronJob?.metadata?.namespace,
          resourceName: name,
          suspend: true,
        });
        // No refetch: the patched `spec.suspend` comes back as a MODIFIED watch event.
        toast.success(`Suspended ${name}`);
      },
    },
    {
      id: 'resume',
      label: 'Resume',
      icon: Play,
      multi: false,
      available: (items: V1CronJob[]) => {
        const cronJob = items[0];
        return cronJob !== undefined && isSuspended(cronJob);
      },
      run: async (items: V1CronJob[], ctx) => {
        const cronJob = items[0];
        const name = cronJob?.metadata?.name;
        if (!name) return;

        if (!(await confirmSuspend(name, false))) return;

        await suspendCronJob({
          name: ctx.context,
          namespace: cronJob?.metadata?.namespace,
          resourceName: name,
          suspend: false,
        });
        toast.success(`Resumed ${name}`);
      },
    },
  ],
});
