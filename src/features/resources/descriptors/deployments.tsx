/**
 * Deployments.
 *
 * Two things here are not in the React original and are the reason the file exists at
 * all rather than being a copy of `secrets.tsx` with different fields:
 *
 * - **Status is a word, not a ratio.** `utils/deploymentStatus.ts` returned
 *   `"3 / 3"` as the *status string* and hued it. That is the Ready column's job, and
 *   it meant the badge could never say `Paused`, `ProgressDeadlineExceeded` or
 *   `ReplicaFailure` — the three states a Deployment list exists to surface.
 * - **Restart and Scale are `ResourceAction`s.** In React they were buttons wired into
 *   `SidebarDeployments` with their own modals, four `useState`s and a `patching` flag
 *   threaded through six props. Here they are two entries in `actions`, and the panel
 *   renders them without knowing what a Deployment is.
 */

import { For, Show } from 'solid-js';
import { Layers, RotateCw, Scaling } from 'lucide-solid';
import type { V1Container, V1Deployment, V1OwnerReference } from '@kubernetes/client-node';

import {
  deleteDeployments,
  listDeployments,
  restartDeployment,
  scaleDeployment,
  updateDeployment,
  watchDeployments,
} from '@/api/k8s/deployments';
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

const conditionStatus = (deployment: V1Deployment, type: string): string | undefined => {
  const conditions = deployment.status?.conditions;
  if (!conditions) return undefined;
  for (const condition of conditions) {
    if (condition.type === type) return condition.status;
  }
  return undefined;
};

const conditionReason = (deployment: V1Deployment, type: string): string | undefined => {
  const conditions = deployment.status?.conditions;
  if (!conditions) return undefined;
  for (const condition of conditions) {
    if (condition.type === type) return condition.reason;
  }
  return undefined;
};

/**
 * The state to show in the Status column.
 *
 * The ready/desired hue mapping is the one from `utils/deploymentStatus.ts` — all
 * ready is `success`, some ready is `warning`, none ready is `error`. What is new is
 * that the three conditions the apiserver actually reports (`ReplicaFailure`,
 * `Progressing=False`, `paused`) get to override it, because each of them means the
 * ratio has stopped moving and will not resume on its own.
 *
 * Written with loops rather than `find`: this runs per row per sort.
 */
export const getDeploymentStatus = (deployment: V1Deployment): K8sStatus => {
  if (deployment.spec?.paused) return { status: 'Paused', variant: 'default' };

  if (conditionStatus(deployment, 'ReplicaFailure') === 'True') {
    return {
      status: conditionReason(deployment, 'ReplicaFailure') ?? 'ReplicaFailure',
      variant: 'error',
    };
  }

  if (conditionStatus(deployment, 'Progressing') === 'False') {
    return {
      status: conditionReason(deployment, 'Progressing') ?? 'ProgressDeadlineExceeded',
      variant: 'error',
    };
  }

  const desired = deployment.spec?.replicas ?? 0;
  const ready = deployment.status?.readyReplicas ?? 0;

  if (desired === 0) return { status: 'Scaled to zero', variant: 'secondary' };
  if (ready >= desired) return { status: 'Available', variant: 'success' };
  if (ready > 0) return { status: 'Progressing', variant: 'warning' };
  return { status: 'Unavailable', variant: 'error' };
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

const strategySummary = (deployment: V1Deployment): string | undefined => {
  const strategy = deployment.spec?.strategy;
  if (!strategy?.type) return undefined;
  if (strategy.type !== 'RollingUpdate') return strategy.type;

  const surge = strategy.rollingUpdate?.maxSurge ?? '25%';
  const unavailable = strategy.rollingUpdate?.maxUnavailable ?? '25%';
  return `RollingUpdate (max surge ${surge}, max unavailable ${unavailable})`;
};

const volumeNames = (deployment: V1Deployment): string | undefined => {
  const volumes = deployment.spec?.template.spec?.volumes;
  if (!volumes || volumes.length === 0) return undefined;
  return volumes.map((volume) => volume.name).join(', ');
};

const selectorSummary = (deployment: V1Deployment): string | undefined => {
  const expressions = deployment.spec?.selector?.matchExpressions;
  if (!expressions || expressions.length === 0) return undefined;
  return expressions
    .map((expression) =>
      `${expression.key} ${expression.operator} ${expression.values?.join(',') ?? ''}`.trim()
    )
    .join(', ');
};

/* -------------------------------------------------------------------------- */
/* Descriptor                                                                 */
/* -------------------------------------------------------------------------- */

export const deploymentsDescriptor = defineResource({
  id: 'deployments',
  kind: 'Deployment',
  title: 'Deployments',
  group: 'workloads',
  icon: Layers,
  namespaced: true,

  api: {
    list: listDeployments,
    watch: watchDeployments,
    remove: deleteDeployments,
    update: updateDeployment,
  },

  status: getDeploymentStatus,

  searchExtra: (deployment: V1Deployment) => [
    ...Object.entries(deployment.metadata?.labels ?? {}).map(([key, value]) => `${key}=${value}`),
    ...(deployment.spec?.template.spec?.containers ?? []).map((container) => container.image),
  ],

  columns: [
    {
      id: 'name',
      header: 'Name',
      width: 'minmax(180px, 2.5fr)',
      value: (deployment: V1Deployment) => deployment.metadata?.name,
    },
    {
      id: 'namespace',
      header: 'Namespace',
      width: 'minmax(110px, 1.2fr)',
      value: (deployment: V1Deployment) => deployment.metadata?.namespace,
    },
    {
      id: 'ready',
      header: 'Ready',
      width: '72px',
      // The ready count, not the `n/m` string: sorting text puts 10/10 before 2/2.
      value: (deployment: V1Deployment) => deployment.status?.readyReplicas ?? 0,
      cell: (deployment: V1Deployment) => (
        <span class="tnum">
          {deployment.status?.readyReplicas ?? 0}/{deployment.spec?.replicas ?? 0}
        </span>
      ),
    },
    {
      id: 'uptodate',
      header: 'Up-to-date',
      width: '92px',
      align: 'right',
      value: (deployment: V1Deployment) => deployment.status?.updatedReplicas ?? 0,
    },
    {
      id: 'available',
      header: 'Available',
      width: '84px',
      align: 'right',
      value: (deployment: V1Deployment) => deployment.status?.availableReplicas ?? 0,
    },
    {
      id: 'status',
      header: 'Status',
      width: 'minmax(120px, 1.5fr)',
      value: (deployment: V1Deployment) => getDeploymentStatus(deployment).status,
      cell: (deployment: V1Deployment) => {
        const status = getDeploymentStatus(deployment);
        return <StatusBadge status={status.status} variant={status.variant} size="sm" />;
      },
    },
    {
      id: 'age',
      header: 'Age',
      width: '68px',
      align: 'right',
      value: (deployment: V1Deployment) => ageValue(deployment),
      cell: (deployment: V1Deployment) => (
        <AgeCell timestamp={deployment.metadata?.creationTimestamp} />
      ),
    },
  ],

  detail: [
    {
      id: 'metadata',
      title: 'Metadata',
      render: (deployment: V1Deployment) => (
        <DetailGrid>
          <DetailRow label="Name">{deployment.metadata?.name}</DetailRow>
          <DetailRow label="Namespace">{deployment.metadata?.namespace}</DetailRow>
          <DetailRow label="Created">
            <AgeCell timestamp={deployment.metadata?.creationTimestamp} /> ago
          </DetailRow>
          <DetailRow label="Generation">{deployment.metadata?.generation}</DetailRow>
          <DetailRow label="Controlled by">
            {ownerSummary(deployment.metadata?.ownerReferences)}
          </DetailRow>
          <DetailRow label="Labels">
            <LabelList entries={deployment.metadata?.labels} />
          </DetailRow>
          <DetailRow label="Annotations">
            <LabelList entries={deployment.metadata?.annotations} />
          </DetailRow>
        </DetailGrid>
      ),
    },
    {
      id: 'replicas',
      title: 'Replicas',
      render: (deployment: V1Deployment) => (
        <DetailGrid>
          <DetailRow label="Desired">{deployment.spec?.replicas ?? 0}</DetailRow>
          <DetailRow label="Current">{deployment.status?.replicas ?? 0}</DetailRow>
          <DetailRow label="Ready">{deployment.status?.readyReplicas ?? 0}</DetailRow>
          <DetailRow label="Up-to-date">{deployment.status?.updatedReplicas ?? 0}</DetailRow>
          <DetailRow label="Available">{deployment.status?.availableReplicas ?? 0}</DetailRow>
          <DetailRow label="Unavailable">{deployment.status?.unavailableReplicas ?? 0}</DetailRow>
          <DetailRow label="Min ready">{deployment.spec?.minReadySeconds ?? 0}s</DetailRow>
        </DetailGrid>
      ),
    },
    {
      id: 'strategy',
      title: 'Strategy',
      render: (deployment: V1Deployment) => (
        <DetailGrid>
          <DetailRow label="Type">{strategySummary(deployment)}</DetailRow>
          <DetailRow label="Paused">{deployment.spec?.paused ? 'Yes' : 'No'}</DetailRow>
          <DetailRow label="Revision limit">{deployment.spec?.revisionHistoryLimit}</DetailRow>
          <DetailRow label="Progress deadline">
            <Show when={deployment.spec?.progressDeadlineSeconds}>
              {(seconds) => `${seconds()}s`}
            </Show>
          </DetailRow>
        </DetailGrid>
      ),
    },
    {
      id: 'selector',
      title: 'Selector',
      render: (deployment: V1Deployment) => (
        <DetailGrid>
          <DetailRow label="Match labels">
            <LabelList entries={deployment.spec?.selector?.matchLabels} />
          </DetailRow>
          <DetailRow label="Expressions">{selectorSummary(deployment)}</DetailRow>
        </DetailGrid>
      ),
    },
    {
      id: 'template',
      title: 'Pod template',
      render: (deployment: V1Deployment) => (
        <div class="flex flex-col gap-2">
          <DetailGrid>
            <DetailRow label="Labels">
              <LabelList entries={deployment.spec?.template.metadata?.labels} />
            </DetailRow>
            <DetailRow label="Service account">
              {deployment.spec?.template.spec?.serviceAccountName}
            </DetailRow>
            <DetailRow label="Node selector">
              <LabelList entries={deployment.spec?.template.spec?.nodeSelector} empty="Any node" />
            </DetailRow>
            <DetailRow label="Volumes">{volumeNames(deployment)}</DetailRow>
          </DetailGrid>

          <For each={deployment.spec?.template.spec?.containers}>
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
      render: (deployment: V1Deployment) => (
        <ConditionsTable conditions={deployment.status?.conditions} />
      ),
    },
  ],

  actions: [
    {
      id: 'restart',
      label: 'Restart',
      icon: RotateCw,
      // A rolling restart of ten Deployments at once is never what someone meant to ask
      // for, and there is no undo.
      multi: false,
      run: async (items: V1Deployment[], ctx) => {
        const deployment = items[0];
        const name = deployment?.metadata?.name;
        if (!name) return;

        if (!(await confirmRestart(name))) return;

        await restartDeployment({
          name: ctx.context,
          namespace: deployment?.metadata?.namespace,
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
      run: async (items: V1Deployment[], ctx) => {
        const deployment = items[0];
        const name = deployment?.metadata?.name;
        if (!name) return;

        const replicas = await promptReplicas(name, deployment?.spec?.replicas ?? 0);
        if (replicas === null) return;

        await scaleDeployment({
          name: ctx.context,
          namespace: deployment?.metadata?.namespace,
          resourceName: name,
          replicas,
        });
        toast.success(`Scaled ${name} to ${replicas} replica${replicas === 1 ? '' : 's'}`);
      },
    },
  ],
});
