/**
 * StatefulSets.
 *
 * `utils/statefulSetStatus.ts` had two bugs, one of which also affected the Ready column:
 *
 * - **The denominator was wrong.** It read `status.replicas` as "desired". That field is
 *   the number of pods the controller has *created*; the number asked for is
 *   `spec.replicas`. During a scale-up, and for any StatefulSet whose pods cannot be
 *   scheduled, `status.replicas` lags behind — so a StatefulSet asked for 3 replicas with
 *   1 running rendered `1/1` in `success` green. The one case where a StatefulSet is most
 *   likely to be wedged is the case the React table called healthy. `kubectl get sts`
 *   prints `status.readyReplicas / spec.replicas`, and so does this file.
 * - **Status was a ratio, not a word.** Same as Deployments: the ratio is the Ready
 *   column's job, and using it as the status string left `currentRevision !=
 *   updateRevision` — a stalled rolling update, the thing that actually goes wrong with
 *   this kind — with nowhere to appear.
 */

import { For, Show } from 'solid-js';
import { Database, RotateCw, Scaling } from 'lucide-solid';
import type {
  V1Container,
  V1OwnerReference,
  V1PersistentVolumeClaim,
  V1StatefulSet,
} from '@kubernetes/client-node';

import {
  deleteStatefulSets,
  listStatefulSets,
  restartStatefulSet,
  scaleStatefulSet,
  updateStatefulSet,
  watchStatefulSets,
} from '@/api/k8s/statefulSets';
import type { K8sStatus } from '@/types/k8sStatus';
import { StatusBadge } from '@/ui/StatusBadge';
import { toast } from '@/ui/Toast';

import {
  AgeCell,
  ConditionsTable,
  DetailGrid,
  DetailRow,
  LabelList,
  ageValue,
} from '../detail-parts';
import { confirmRestart, promptReplicas } from '../scale-dialog';
import { defineResource } from '../types';

/* -------------------------------------------------------------------------- */
/* Status                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The state to show in the Status column.
 *
 * The hue mapping is the one from `utils/statefulSetStatus.ts` — all ready is `success`,
 * some ready is `warning`, none ready is `error` — with the desired count read from
 * `spec.replicas` and two states a ratio cannot express layered on top:
 *
 * - `spec.replicas === 0` is a deliberate stop, not a failure.
 * - `currentRevision !== updateRevision` means a rolling update is still in flight. Every
 *   pod can be ready while half of them run the previous revision, which is exactly what
 *   a StatefulSet update blocked on an unready ordinal looks like.
 *
 * Plain field reads, no allocation: this runs per row per sort.
 */
export const getStatefulSetStatus = (statefulSet: V1StatefulSet): K8sStatus => {
  const desired = statefulSet.spec?.replicas ?? 0;
  const ready = statefulSet.status?.readyReplicas ?? 0;

  if (desired === 0) return { status: 'Scaled to zero', variant: 'secondary' };
  if (ready === 0) return { status: 'Unavailable', variant: 'error' };
  if (ready < desired) return { status: 'Progressing', variant: 'warning' };

  const current = statefulSet.status?.currentRevision;
  const update = statefulSet.status?.updateRevision;
  if (current && update && current !== update) {
    return { status: 'Rolling out', variant: 'warning' };
  }

  return { status: 'Available', variant: 'success' };
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

const strategySummary = (statefulSet: V1StatefulSet): string | undefined => {
  const strategy = statefulSet.spec?.updateStrategy;
  if (!strategy?.type) return undefined;
  if (strategy.type !== 'RollingUpdate') return strategy.type;

  // `partition` is why a StatefulSet update can look stuck when it is doing exactly what
  // it was told: ordinals below it are never updated. Worth printing whenever it is set.
  const partition = strategy.rollingUpdate?.partition;
  const parts: string[] = [];
  if (partition !== undefined) parts.push(`partition ${partition}`);
  const unavailable = strategy.rollingUpdate?.maxUnavailable;
  if (unavailable !== undefined) parts.push(`max unavailable ${unavailable}`);
  return parts.length === 0 ? 'RollingUpdate' : `RollingUpdate (${parts.join(', ')})`;
};

const selectorSummary = (statefulSet: V1StatefulSet): string | undefined => {
  const expressions = statefulSet.spec?.selector?.matchExpressions;
  if (!expressions || expressions.length === 0) return undefined;
  return expressions
    .map((expression) =>
      `${expression.key} ${expression.operator} ${expression.values?.join(',') ?? ''}`.trim()
    )
    .join(', ');
};

/** `10Gi (fast-ssd, ReadWriteOnce)` — the three things a claim template is read for. */
const claimSummary = (claim: V1PersistentVolumeClaim): string => {
  const size = claim.spec?.resources?.requests?.['storage'] ?? '?';
  const parts = [claim.spec?.storageClassName, claim.spec?.accessModes?.join(', ')].filter(
    (part): part is string => part !== undefined && part !== ''
  );
  return parts.length === 0 ? size : `${size} (${parts.join(', ')})`;
};

const volumeNames = (statefulSet: V1StatefulSet): string | undefined => {
  const volumes = statefulSet.spec?.template.spec?.volumes;
  if (!volumes || volumes.length === 0) return undefined;
  return volumes.map((volume) => volume.name).join(', ');
};

/* -------------------------------------------------------------------------- */
/* Descriptor                                                                 */
/* -------------------------------------------------------------------------- */

export const statefulSetsDescriptor = defineResource({
  id: 'statefulSets',
  kind: 'StatefulSet',
  title: 'StatefulSets',
  group: 'workloads',
  icon: Database,
  namespaced: true,

  api: {
    list: listStatefulSets,
    watch: watchStatefulSets,
    remove: deleteStatefulSets,
    update: updateStatefulSet,
  },

  status: getStatefulSetStatus,

  searchExtra: (statefulSet: V1StatefulSet) => [
    statefulSet.spec?.serviceName,
    ...Object.entries(statefulSet.metadata?.labels ?? {}).map(([key, value]) => `${key}=${value}`),
    ...(statefulSet.spec?.template.spec?.containers ?? []).map((container) => container.image),
  ],

  columns: [
    {
      id: 'name',
      header: 'Name',
      width: 'minmax(180px, 2.5fr)',
      value: (statefulSet: V1StatefulSet) => statefulSet.metadata?.name,
    },
    {
      id: 'namespace',
      header: 'Namespace',
      width: 'minmax(110px, 1.2fr)',
      value: (statefulSet: V1StatefulSet) => statefulSet.metadata?.namespace,
    },
    {
      id: 'ready',
      header: 'Ready',
      width: '72px',
      // The ready count, not the `n/m` string: sorting text puts 10/10 before 2/2.
      value: (statefulSet: V1StatefulSet) => statefulSet.status?.readyReplicas ?? 0,
      cell: (statefulSet: V1StatefulSet) => (
        <span class="tnum">
          {statefulSet.status?.readyReplicas ?? 0}/{statefulSet.spec?.replicas ?? 0}
        </span>
      ),
    },
    {
      id: 'service',
      header: 'Service',
      width: 'minmax(110px, 1.5fr)',
      value: (statefulSet: V1StatefulSet) => statefulSet.spec?.serviceName,
    },
    {
      id: 'status',
      header: 'Status',
      width: 'minmax(110px, 1.4fr)',
      value: (statefulSet: V1StatefulSet) => getStatefulSetStatus(statefulSet).status,
      cell: (statefulSet: V1StatefulSet) => {
        const status = getStatefulSetStatus(statefulSet);
        return <StatusBadge status={status.status} variant={status.variant} size="sm" />;
      },
    },
    {
      id: 'age',
      header: 'Age',
      width: '68px',
      align: 'right',
      value: (statefulSet: V1StatefulSet) => ageValue(statefulSet),
      cell: (statefulSet: V1StatefulSet) => (
        <AgeCell timestamp={statefulSet.metadata?.creationTimestamp} />
      ),
    },
  ],

  detail: [
    {
      id: 'metadata',
      title: 'Metadata',
      render: (statefulSet: V1StatefulSet) => (
        <DetailGrid>
          <DetailRow label="Name">{statefulSet.metadata?.name}</DetailRow>
          <DetailRow label="Namespace">{statefulSet.metadata?.namespace}</DetailRow>
          <DetailRow label="Created">
            <AgeCell timestamp={statefulSet.metadata?.creationTimestamp} /> ago
          </DetailRow>
          <DetailRow label="Generation">{statefulSet.metadata?.generation}</DetailRow>
          <DetailRow label="Controlled by">
            {ownerSummary(statefulSet.metadata?.ownerReferences)}
          </DetailRow>
          <DetailRow label="Labels">
            <LabelList entries={statefulSet.metadata?.labels} />
          </DetailRow>
          <DetailRow label="Annotations">
            <LabelList entries={statefulSet.metadata?.annotations} />
          </DetailRow>
        </DetailGrid>
      ),
    },
    {
      id: 'replicas',
      title: 'Replicas',
      render: (statefulSet: V1StatefulSet) => (
        <DetailGrid>
          <DetailRow label="Desired">{statefulSet.spec?.replicas ?? 0}</DetailRow>
          <DetailRow label="Created">{statefulSet.status?.replicas ?? 0}</DetailRow>
          <DetailRow label="Ready">{statefulSet.status?.readyReplicas ?? 0}</DetailRow>
          <DetailRow label="Current">{statefulSet.status?.currentReplicas ?? 0}</DetailRow>
          <DetailRow label="Updated">{statefulSet.status?.updatedReplicas ?? 0}</DetailRow>
          <DetailRow label="Available">{statefulSet.status?.availableReplicas ?? 0}</DetailRow>
          <DetailRow label="Min ready">{statefulSet.spec?.minReadySeconds ?? 0}s</DetailRow>
        </DetailGrid>
      ),
    },
    {
      id: 'strategy',
      title: 'Identity & updates',
      render: (statefulSet: V1StatefulSet) => (
        <DetailGrid>
          <DetailRow label="Service">{statefulSet.spec?.serviceName}</DetailRow>
          <DetailRow label="Pod management">{statefulSet.spec?.podManagementPolicy}</DetailRow>
          <DetailRow label="Update strategy">{strategySummary(statefulSet)}</DetailRow>
          <DetailRow label="Start ordinal">{statefulSet.spec?.ordinals?.start}</DetailRow>
          <DetailRow label="Revision limit">{statefulSet.spec?.revisionHistoryLimit}</DetailRow>
          <DetailRow label="Current revision">
            <span class="text-2xs font-mono">{statefulSet.status?.currentRevision}</span>
          </DetailRow>
          <DetailRow label="Update revision">
            <span class="text-2xs font-mono">{statefulSet.status?.updateRevision}</span>
          </DetailRow>
        </DetailGrid>
      ),
    },
    {
      id: 'storage',
      title: 'Volume claim templates',
      render: (statefulSet: V1StatefulSet) => (
        <Show
          when={(statefulSet.spec?.volumeClaimTemplates ?? []).length > 0}
          fallback={<span class="text-2xs text-[var(--text-tertiary)]">None</span>}
        >
          <DetailGrid>
            <For each={statefulSet.spec?.volumeClaimTemplates}>
              {(claim) => (
                <DetailRow label={claim.metadata?.name ?? 'claim'}>{claimSummary(claim)}</DetailRow>
              )}
            </For>
            {/* The retention policy decides whether the data outlives a scale-down or a
                delete, which is the one thing about a StatefulSet nobody wants to guess. */}
            <DetailRow label="On delete">
              {statefulSet.spec?.persistentVolumeClaimRetentionPolicy?.whenDeleted ?? 'Retain'}
            </DetailRow>
            <DetailRow label="On scale-down">
              {statefulSet.spec?.persistentVolumeClaimRetentionPolicy?.whenScaled ?? 'Retain'}
            </DetailRow>
          </DetailGrid>
        </Show>
      ),
    },
    {
      id: 'selector',
      title: 'Selector',
      render: (statefulSet: V1StatefulSet) => (
        <DetailGrid>
          <DetailRow label="Match labels">
            <LabelList entries={statefulSet.spec?.selector?.matchLabels} />
          </DetailRow>
          <DetailRow label="Expressions">{selectorSummary(statefulSet)}</DetailRow>
        </DetailGrid>
      ),
    },
    {
      id: 'template',
      title: 'Pod template',
      render: (statefulSet: V1StatefulSet) => (
        <div class="flex flex-col gap-2">
          <DetailGrid>
            <DetailRow label="Labels">
              <LabelList entries={statefulSet.spec?.template.metadata?.labels} />
            </DetailRow>
            <DetailRow label="Service account">
              {statefulSet.spec?.template.spec?.serviceAccountName}
            </DetailRow>
            <DetailRow label="Node selector">
              <LabelList entries={statefulSet.spec?.template.spec?.nodeSelector} empty="Any node" />
            </DetailRow>
            <DetailRow label="Volumes">{volumeNames(statefulSet)}</DetailRow>
          </DetailGrid>

          <For each={statefulSet.spec?.template.spec?.containers}>
            {(container) => (
              <div class="rounded-sm border border-[var(--border-subtle)] bg-[var(--surface-inset)] p-2">
                <div class="selectable mb-1.5 truncate font-medium text-[var(--text-primary)]">
                  {container.name}
                </div>
                <DetailGrid>
                  <DetailRow label="Image">{container.image}</DetailRow>
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
      render: (statefulSet: V1StatefulSet) => (
        <ConditionsTable conditions={statefulSet.status?.conditions} />
      ),
    },
  ],

  actions: [
    {
      id: 'restart',
      label: 'Restart',
      icon: RotateCw,
      // A rolling restart of ten StatefulSets at once is never what someone meant to ask
      // for, and there is no undo.
      multi: false,
      run: async (items: V1StatefulSet[], ctx) => {
        const statefulSet = items[0];
        const name = statefulSet?.metadata?.name;
        if (!name) return;

        const confirmed = await confirmRestart(
          name,
          'Pods are replaced one ordinal at a time, highest first, and each must become ready before the next is touched. A pod that never becomes ready stops the restart part-way.'
        );
        if (!confirmed) return;

        await restartStatefulSet({
          name: ctx.context,
          namespace: statefulSet?.metadata?.namespace,
          resourceName: name,
        });
        // No refetch: the patched `spec.template.metadata.annotations` comes back as a
        // MODIFIED watch event, and the rollout follows on the pods screen.
        toast.success(`Restarting ${name}`);
      },
    },
    {
      id: 'scale',
      label: 'Scale',
      icon: Scaling,
      multi: false,
      run: async (items: V1StatefulSet[], ctx) => {
        const statefulSet = items[0];
        const name = statefulSet?.metadata?.name;
        if (!name) return;

        const replicas = await promptReplicas(name, statefulSet?.spec?.replicas ?? 0);
        if (replicas === null) return;

        await scaleStatefulSet({
          name: ctx.context,
          namespace: statefulSet?.metadata?.namespace,
          resourceName: name,
          replicas,
        });
        toast.success(`Scaled ${name} to ${replicas} replica${replicas === 1 ? '' : 's'}`);
      },
    },
  ],
});
