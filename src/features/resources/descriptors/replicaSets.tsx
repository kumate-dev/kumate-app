/**
 * ReplicaSets.
 *
 * Almost every ReplicaSet on a cluster is a *former* revision of a Deployment, kept for
 * rollback and scaled to zero. Two things follow, and they shape this file:
 *
 * - **The owning Deployment and the revision are the identifying facts**, not the name —
 *   `web-7d4b8c9f5` tells you nothing on its own. Both are surfaced at the top of the
 *   detail panel: the owner from `metadata.ownerReferences`, the revision from the
 *   `deployment.kubernetes.io/revision` annotation the Deployment controller writes.
 * - **Scaled to zero is the normal state**, so it must not render as a failure.
 *   `utils/replicaSetStatus.ts` returned `"0 / 0"` in the `default` hue for it, which is
 *   the ratio-as-status bug the Deployments port already documented; here it is a word.
 *
 * The same helper also read `status.replicas` as the desired count. That field is what the
 * controller has *created*; the desired count is `spec.replicas`. `kubectl get rs` prints
 * DESIRED from the spec and CURRENT from the status, and the difference between the two is
 * the entire reason to look at this screen — a ReplicaSet that cannot create its pods
 * (quota, a missing image pull secret, a `ReplicaFailure` condition) has DESIRED 3 and
 * CURRENT 0. The React version showed `0 / 0`: healthy.
 */

import { For } from 'solid-js';
import { Copy, Scaling } from 'lucide-solid';
import type { V1Container, V1OwnerReference, V1ReplicaSet } from '@kubernetes/client-node';

import {
  deleteReplicaSets,
  listReplicaSets,
  updateReplicaSet,
  watchReplicaSets,
} from '@/api/k8s/replicaSets';
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
import { promptReplicas } from '../scale-dialog';
import { defineResource } from '../types';

/* -------------------------------------------------------------------------- */
/* Status                                                                     */
/* -------------------------------------------------------------------------- */

const conditionStatus = (replicaSet: V1ReplicaSet, type: string): string | undefined => {
  const conditions = replicaSet.status?.conditions;
  if (!conditions) return undefined;
  for (const condition of conditions) {
    if (condition.type === type) return condition.status;
  }
  return undefined;
};

const conditionReason = (replicaSet: V1ReplicaSet, type: string): string | undefined => {
  const conditions = replicaSet.status?.conditions;
  if (!conditions) return undefined;
  for (const condition of conditions) {
    if (condition.type === type) return condition.reason;
  }
  return undefined;
};

/**
 * The state to show in the Status column.
 *
 * `ReplicaFailure=True` comes first because it is the only place the apiserver explains
 * *why* the pods do not exist — `FailedCreate` with an exceeded quota, a rejected pod
 * security policy, a missing service account. Without it a wedged ReplicaSet is
 * indistinguishable from one that is merely slow.
 *
 * Loops rather than `find`: this runs per row per sort, and there are typically ten
 * ReplicaSets per Deployment.
 */
export const getReplicaSetStatus = (replicaSet: V1ReplicaSet): K8sStatus => {
  const desired = replicaSet.spec?.replicas ?? 0;
  const current = replicaSet.status?.replicas ?? 0;

  // Checked before the failure condition: a stale revision keeps whatever condition it
  // had when it was scaled down, and reporting that as a live error would paint most of
  // the screen red.
  if (desired === 0) {
    return current === 0
      ? { status: 'Scaled to zero', variant: 'secondary' }
      : { status: 'Terminating', variant: 'warning' };
  }

  if (conditionStatus(replicaSet, 'ReplicaFailure') === 'True') {
    return {
      status: conditionReason(replicaSet, 'ReplicaFailure') ?? 'ReplicaFailure',
      variant: 'error',
    };
  }

  const ready = replicaSet.status?.readyReplicas ?? 0;
  if (ready >= desired) return { status: 'Available', variant: 'success' };
  if (ready > 0) return { status: 'Progressing', variant: 'warning' };
  return { status: 'Unavailable', variant: 'error' };
};

/* -------------------------------------------------------------------------- */
/* Ownership                                                                  */
/* -------------------------------------------------------------------------- */

/** The revision the Deployment controller stamped on this ReplicaSet, if any. */
const REVISION_ANNOTATION = 'deployment.kubernetes.io/revision';

/**
 * The controller that owns this ReplicaSet, as `Deployment/web`.
 *
 * Only the reference with `controller: true` counts. A ReplicaSet can carry several owner
 * references — anything that wants garbage collection to cascade adds one — but exactly
 * one of them is the controller, and that is the object whose rollout this ReplicaSet
 * belongs to.
 */
const controllerRef = (owners?: V1OwnerReference[]): V1OwnerReference | undefined => {
  if (!owners) return undefined;
  for (const owner of owners) {
    if (owner.controller === true) return owner;
  }
  return owners[0];
};

const controllerSummary = (replicaSet: V1ReplicaSet): string | undefined => {
  const owner = controllerRef(replicaSet.metadata?.ownerReferences);
  return owner ? `${owner.kind}/${owner.name}` : undefined;
};

/* -------------------------------------------------------------------------- */
/* Detail helpers                                                             */
/* -------------------------------------------------------------------------- */

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

const selectorSummary = (replicaSet: V1ReplicaSet): string | undefined => {
  const expressions = replicaSet.spec?.selector?.matchExpressions;
  if (!expressions || expressions.length === 0) return undefined;
  return expressions
    .map((expression) =>
      `${expression.key} ${expression.operator} ${expression.values?.join(',') ?? ''}`.trim()
    )
    .join(', ');
};

const volumeNames = (replicaSet: V1ReplicaSet): string | undefined => {
  const volumes = replicaSet.spec?.template?.spec?.volumes;
  if (!volumes || volumes.length === 0) return undefined;
  return volumes.map((volume) => volume.name).join(', ');
};

/* -------------------------------------------------------------------------- */
/* Descriptor                                                                 */
/* -------------------------------------------------------------------------- */

export const replicaSetsDescriptor = defineResource({
  id: 'replicaSets',
  kind: 'ReplicaSet',
  title: 'ReplicaSets',
  group: 'workloads',
  icon: Copy,
  namespaced: true,

  api: {
    list: listReplicaSets,
    watch: watchReplicaSets,
    remove: deleteReplicaSets,
    update: updateReplicaSet,
  },

  status: getReplicaSetStatus,

  searchExtra: (replicaSet: V1ReplicaSet) => [
    // The owner is how anyone looks for a ReplicaSet: the generated name suffix is not
    // something people remember, `Deployment/web` is.
    controllerSummary(replicaSet),
    ...Object.entries(replicaSet.metadata?.labels ?? {}).map(([key, value]) => `${key}=${value}`),
    ...(replicaSet.spec?.template?.spec?.containers ?? []).map((container) => container.image),
  ],

  columns: [
    {
      id: 'name',
      header: 'Name',
      width: 'minmax(180px, 2.5fr)',
      value: (replicaSet: V1ReplicaSet) => replicaSet.metadata?.name,
    },
    {
      id: 'namespace',
      header: 'Namespace',
      width: 'minmax(110px, 1.2fr)',
      value: (replicaSet: V1ReplicaSet) => replicaSet.metadata?.namespace,
    },
    {
      id: 'desired',
      header: 'Desired',
      width: '68px',
      align: 'right',
      value: (replicaSet: V1ReplicaSet) => replicaSet.spec?.replicas ?? 0,
    },
    {
      id: 'current',
      header: 'Current',
      width: '68px',
      align: 'right',
      value: (replicaSet: V1ReplicaSet) => replicaSet.status?.replicas ?? 0,
    },
    {
      id: 'ready',
      header: 'Ready',
      width: '64px',
      align: 'right',
      value: (replicaSet: V1ReplicaSet) => replicaSet.status?.readyReplicas ?? 0,
    },
    {
      id: 'status',
      header: 'Status',
      width: 'minmax(110px, 1.4fr)',
      value: (replicaSet: V1ReplicaSet) => getReplicaSetStatus(replicaSet).status,
      cell: (replicaSet: V1ReplicaSet) => {
        const status = getReplicaSetStatus(replicaSet);
        return <StatusBadge status={status.status} variant={status.variant} size="sm" />;
      },
    },
    {
      id: 'age',
      header: 'Age',
      width: '68px',
      align: 'right',
      value: (replicaSet: V1ReplicaSet) => ageValue(replicaSet),
      cell: (replicaSet: V1ReplicaSet) => (
        <AgeCell timestamp={replicaSet.metadata?.creationTimestamp} />
      ),
    },
  ],

  detail: [
    {
      id: 'metadata',
      title: 'Metadata',
      render: (replicaSet: V1ReplicaSet) => (
        <DetailGrid>
          <DetailRow label="Name">{replicaSet.metadata?.name}</DetailRow>
          <DetailRow label="Namespace">{replicaSet.metadata?.namespace}</DetailRow>
          <DetailRow label="Controlled by">{controllerSummary(replicaSet)}</DetailRow>
          <DetailRow label="Revision">
            {replicaSet.metadata?.annotations?.[REVISION_ANNOTATION]}
          </DetailRow>
          <DetailRow label="Created">
            <AgeCell timestamp={replicaSet.metadata?.creationTimestamp} /> ago
          </DetailRow>
          <DetailRow label="Generation">{replicaSet.metadata?.generation}</DetailRow>
          <DetailRow label="Labels">
            <LabelList entries={replicaSet.metadata?.labels} />
          </DetailRow>
          <DetailRow label="Annotations">
            <LabelList entries={replicaSet.metadata?.annotations} />
          </DetailRow>
        </DetailGrid>
      ),
    },
    {
      id: 'replicas',
      title: 'Replicas',
      render: (replicaSet: V1ReplicaSet) => (
        <DetailGrid>
          <DetailRow label="Desired">{replicaSet.spec?.replicas ?? 0}</DetailRow>
          <DetailRow label="Current">{replicaSet.status?.replicas ?? 0}</DetailRow>
          <DetailRow label="Ready">{replicaSet.status?.readyReplicas ?? 0}</DetailRow>
          <DetailRow label="Available">{replicaSet.status?.availableReplicas ?? 0}</DetailRow>
          <DetailRow label="Fully labeled">
            {replicaSet.status?.fullyLabeledReplicas ?? 0}
          </DetailRow>
          <DetailRow label="Min ready">{replicaSet.spec?.minReadySeconds ?? 0}s</DetailRow>
        </DetailGrid>
      ),
    },
    {
      id: 'selector',
      title: 'Selector',
      render: (replicaSet: V1ReplicaSet) => (
        <DetailGrid>
          <DetailRow label="Match labels">
            <LabelList entries={replicaSet.spec?.selector?.matchLabels} />
          </DetailRow>
          <DetailRow label="Expressions">{selectorSummary(replicaSet)}</DetailRow>
        </DetailGrid>
      ),
    },
    {
      id: 'template',
      title: 'Pod template',
      render: (replicaSet: V1ReplicaSet) => (
        <div class="flex flex-col gap-2">
          <DetailGrid>
            <DetailRow label="Labels">
              <LabelList entries={replicaSet.spec?.template?.metadata?.labels} />
            </DetailRow>
            <DetailRow label="Service account">
              {replicaSet.spec?.template?.spec?.serviceAccountName}
            </DetailRow>
            <DetailRow label="Node selector">
              <LabelList entries={replicaSet.spec?.template?.spec?.nodeSelector} empty="Any node" />
            </DetailRow>
            <DetailRow label="Volumes">{volumeNames(replicaSet)}</DetailRow>
          </DetailGrid>

          <For each={replicaSet.spec?.template?.spec?.containers}>
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
      render: (replicaSet: V1ReplicaSet) => (
        <ConditionsTable conditions={replicaSet.status?.conditions} />
      ),
    },
  ],

  actions: [
    {
      id: 'scale',
      label: 'Scale',
      icon: Scaling,
      multi: false,
      // Scaling a ReplicaSet that a Deployment owns is almost always a mistake: the
      // Deployment controller reconciles it straight back. Saying so beats hiding the
      // action, because scaling a *standalone* ReplicaSet is legitimate and the user may
      // be doing exactly that.
      disabledReason: (items: V1ReplicaSet[]) => {
        const owner = controllerRef(items[0]?.metadata?.ownerReferences);
        if (!owner) return null;
        return `Owned by ${owner.kind}/${owner.name}, which will reset the replica count. Scale the ${owner.kind} instead.`;
      },
      run: async (items: V1ReplicaSet[], ctx) => {
        const replicaSet = items[0];
        const name = replicaSet?.metadata?.name;
        const spec = replicaSet?.spec;
        if (!name || !spec) return;

        const replicas = await promptReplicas(name, spec.replicas ?? 0);
        if (replicas === null) return;

        // KNOWN ISSUE: there is no `scale_replica_set` command, so this is a full update
        // rather than a PATCH on the `scale` subresource. It is safe — `resourceVersion`
        // travels with the manifest, so a concurrent change is rejected rather than
        // clobbered — but it sends the whole object over IPC and needs RBAC on
        // `replicasets` instead of `replicasets/scale`. Fix: add
        // `k8s_scale_command! { kind: ReplicaSet, ... }` in
        // `src-tauri/src/commands/replica_sets.rs` beside the one ReplicationController
        // already has, export `scaleReplicaSet`, and call it here.
        await updateReplicaSet({
          name: ctx.context,
          namespace: replicaSet?.metadata?.namespace,
          manifest: { ...replicaSet, spec: { ...spec, replicas } },
        });
        toast.success(`Scaled ${name} to ${replicas} replica${replicas === 1 ? '' : 's'}`);
      },
    },
  ],
});
