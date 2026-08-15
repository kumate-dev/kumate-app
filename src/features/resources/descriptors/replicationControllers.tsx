/**
 * ReplicationControllers.
 *
 * The pre-`apps/v1` ancestor of the ReplicaSet, and shaped the same, with one difference
 * that matters to this file: `spec.selector` is a flat `key=value` map, not a
 * `LabelSelector`, so there are no `matchExpressions` to render.
 *
 * `utils/replicationControllerStatus.ts` carried the same two bugs as its ReplicaSet twin,
 * and they are fixed the same way:
 *
 * - It returned `"0 / 0"` as the *status string* and hued the ratio. That is the
 *   Desired/Current/Ready columns' job; the status column exists to say a word the numbers
 *   cannot, and for this kind that word is the `ReplicaFailure` reason.
 * - It read `status.replicas` as the desired count. That field is what the controller has
 *   *created*. `kubectl get rc` prints DESIRED from `spec.replicas`, and a
 *   ReplicationController that cannot create its pods has DESIRED 3, CURRENT 0 — which the
 *   React version rendered as `0 / 0`, i.e. healthy.
 */

import { For } from 'solid-js';
import { Files, Scaling } from 'lucide-solid';
import type {
  V1Container,
  V1OwnerReference,
  V1ReplicationController,
} from '@kubernetes/client-node';

import {
  deleteReplicationControllers,
  listReplicationControllers,
  scaleReplicationController,
  updateReplicationController,
  watchReplicationControllers,
} from '@/api/k8s/replicationControllers';
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

const conditionStatus = (controller: V1ReplicationController, type: string): string | undefined => {
  const conditions = controller.status?.conditions;
  if (!conditions) return undefined;
  for (const condition of conditions) {
    if (condition.type === type) return condition.status;
  }
  return undefined;
};

const conditionReason = (controller: V1ReplicationController, type: string): string | undefined => {
  const conditions = controller.status?.conditions;
  if (!conditions) return undefined;
  for (const condition of conditions) {
    if (condition.type === type) return condition.reason;
  }
  return undefined;
};

/**
 * The state to show in the Status column.
 *
 * `ReplicaFailure=True` first: it is the only place the apiserver explains why the pods do
 * not exist. Loops rather than `find`, because this runs per row per sort.
 */
export const getReplicationControllerStatus = (controller: V1ReplicationController): K8sStatus => {
  const desired = controller.spec?.replicas ?? 0;
  const current = controller.status?.replicas ?? 0;

  if (desired === 0) {
    return current === 0
      ? { status: 'Scaled to zero', variant: 'secondary' }
      : { status: 'Terminating', variant: 'warning' };
  }

  if (conditionStatus(controller, 'ReplicaFailure') === 'True') {
    return {
      status: conditionReason(controller, 'ReplicaFailure') ?? 'ReplicaFailure',
      variant: 'error',
    };
  }

  const ready = controller.status?.readyReplicas ?? 0;
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

const volumeNames = (controller: V1ReplicationController): string | undefined => {
  const volumes = controller.spec?.template?.spec?.volumes;
  if (!volumes || volumes.length === 0) return undefined;
  return volumes.map((volume) => volume.name).join(', ');
};

/* -------------------------------------------------------------------------- */
/* Descriptor                                                                 */
/* -------------------------------------------------------------------------- */

export const replicationControllersDescriptor = defineResource({
  id: 'replicationControllers',
  kind: 'ReplicationController',
  title: 'ReplicationControllers',
  group: 'workloads',
  icon: Files,
  namespaced: true,

  api: {
    list: listReplicationControllers,
    watch: watchReplicationControllers,
    remove: deleteReplicationControllers,
    update: updateReplicationController,
  },

  status: getReplicationControllerStatus,

  searchExtra: (controller: V1ReplicationController) => [
    ...Object.entries(controller.metadata?.labels ?? {}).map(([key, value]) => `${key}=${value}`),
    ...(controller.spec?.template?.spec?.containers ?? []).map((container) => container.image),
  ],

  columns: [
    {
      id: 'name',
      header: 'Name',
      width: 'minmax(180px, 2.5fr)',
      value: (controller: V1ReplicationController) => controller.metadata?.name,
    },
    {
      id: 'namespace',
      header: 'Namespace',
      width: 'minmax(110px, 1.2fr)',
      value: (controller: V1ReplicationController) => controller.metadata?.namespace,
    },
    {
      id: 'desired',
      header: 'Desired',
      width: '68px',
      align: 'right',
      value: (controller: V1ReplicationController) => controller.spec?.replicas ?? 0,
    },
    {
      id: 'current',
      header: 'Current',
      width: '68px',
      align: 'right',
      value: (controller: V1ReplicationController) => controller.status?.replicas ?? 0,
    },
    {
      id: 'ready',
      header: 'Ready',
      width: '64px',
      align: 'right',
      value: (controller: V1ReplicationController) => controller.status?.readyReplicas ?? 0,
    },
    {
      id: 'status',
      header: 'Status',
      width: 'minmax(110px, 1.4fr)',
      value: (controller: V1ReplicationController) =>
        getReplicationControllerStatus(controller).status,
      cell: (controller: V1ReplicationController) => {
        const status = getReplicationControllerStatus(controller);
        return <StatusBadge status={status.status} variant={status.variant} size="sm" />;
      },
    },
    {
      id: 'age',
      header: 'Age',
      width: '68px',
      align: 'right',
      value: (controller: V1ReplicationController) => ageValue(controller),
      cell: (controller: V1ReplicationController) => (
        <AgeCell timestamp={controller.metadata?.creationTimestamp} />
      ),
    },
  ],

  detail: [
    {
      id: 'metadata',
      title: 'Metadata',
      render: (controller: V1ReplicationController) => (
        <DetailGrid>
          <DetailRow label="Name">{controller.metadata?.name}</DetailRow>
          <DetailRow label="Namespace">{controller.metadata?.namespace}</DetailRow>
          <DetailRow label="Created">
            <AgeCell timestamp={controller.metadata?.creationTimestamp} /> ago
          </DetailRow>
          <DetailRow label="Generation">{controller.metadata?.generation}</DetailRow>
          <DetailRow label="Controlled by">
            {ownerSummary(controller.metadata?.ownerReferences)}
          </DetailRow>
          <DetailRow label="Labels">
            <LabelList entries={controller.metadata?.labels} />
          </DetailRow>
          <DetailRow label="Annotations">
            <LabelList entries={controller.metadata?.annotations} />
          </DetailRow>
        </DetailGrid>
      ),
    },
    {
      id: 'replicas',
      title: 'Replicas',
      render: (controller: V1ReplicationController) => (
        <DetailGrid>
          <DetailRow label="Desired">{controller.spec?.replicas ?? 0}</DetailRow>
          <DetailRow label="Current">{controller.status?.replicas ?? 0}</DetailRow>
          <DetailRow label="Ready">{controller.status?.readyReplicas ?? 0}</DetailRow>
          <DetailRow label="Available">{controller.status?.availableReplicas ?? 0}</DetailRow>
          <DetailRow label="Fully labeled">
            {controller.status?.fullyLabeledReplicas ?? 0}
          </DetailRow>
          <DetailRow label="Min ready">{controller.spec?.minReadySeconds ?? 0}s</DetailRow>
        </DetailGrid>
      ),
    },
    {
      id: 'selector',
      title: 'Selector',
      // A flat label map on this kind, not a `LabelSelector`: `LabelList` takes it as-is.
      render: (controller: V1ReplicationController) => (
        <DetailGrid>
          <DetailRow label="Selector">
            <LabelList entries={controller.spec?.selector} empty="Defaults to template labels" />
          </DetailRow>
        </DetailGrid>
      ),
    },
    {
      id: 'template',
      title: 'Pod template',
      render: (controller: V1ReplicationController) => (
        <div class="flex flex-col gap-2">
          <DetailGrid>
            <DetailRow label="Labels">
              <LabelList entries={controller.spec?.template?.metadata?.labels} />
            </DetailRow>
            <DetailRow label="Service account">
              {controller.spec?.template?.spec?.serviceAccountName}
            </DetailRow>
            <DetailRow label="Node selector">
              <LabelList entries={controller.spec?.template?.spec?.nodeSelector} empty="Any node" />
            </DetailRow>
            <DetailRow label="Volumes">{volumeNames(controller)}</DetailRow>
          </DetailGrid>

          <For each={controller.spec?.template?.spec?.containers}>
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
      render: (controller: V1ReplicationController) => (
        <ConditionsTable conditions={controller.status?.conditions} />
      ),
    },
  ],

  actions: [
    {
      id: 'scale',
      label: 'Scale',
      icon: Scaling,
      multi: false,
      run: async (items: V1ReplicationController[], ctx) => {
        const controller = items[0];
        const name = controller?.metadata?.name;
        if (!name) return;

        const replicas = await promptReplicas(name, controller?.spec?.replicas ?? 0);
        if (replicas === null) return;

        await scaleReplicationController({
          name: ctx.context,
          namespace: controller?.metadata?.namespace,
          resourceName: name,
          replicas,
        });
        toast.success(`Scaled ${name} to ${replicas} replica${replicas === 1 ? '' : 's'}`);
      },
    },
  ],
});
