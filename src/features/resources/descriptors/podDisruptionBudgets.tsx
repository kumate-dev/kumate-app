/**
 * PodDisruptionBudgets.
 *
 * ## The status bug
 *
 * `utils/podDisruptionBudgetsStatus.ts` returned `status.conditions[0].type` as the
 * status text and hued it with a switch over `Healthy` / `Degraded` / `Blocked`. A PDB
 * has exactly one condition type — `DisruptionAllowed` — and none of those three words
 * is ever emitted by any apiserver, so the switch always fell through to `default` and
 * **every PDB in every cluster rendered a grey `DisruptionAllowed` badge**, whether it
 * was permitting disruptions or blocking a node drain. The condition's `status` field,
 * the one bit that carries the answer, was never read.
 *
 * `getPodDisruptionBudgetStatus` below reads `status` and `reason`, and checks
 * `observedGeneration` first — the API contract says `disruptionsAllowed` and the rest of
 * `status` are meaningful *only* when it matches `metadata.generation`, so a PDB whose
 * selector was just edited must not be badged on numbers that describe the old selector.
 */

import { For, Show } from 'solid-js';
import { ShieldCheck } from 'lucide-solid';
import type { V1PodDisruptionBudget } from '@kubernetes/client-node';

import {
  deletePodDisruptionBudgets,
  listPodDisruptionBudgets,
  updatePodDisruptionBudget,
  watchPodDisruptionBudgets,
} from '@/api/k8s/podDisruptionBudgets';
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

/** The one condition type the disruption controller sets. */
const DISRUPTION_ALLOWED = 'DisruptionAllowed';

const disruptionCondition = (pdb: V1PodDisruptionBudget) => {
  for (const condition of pdb.status?.conditions ?? []) {
    if (condition.type === DISRUPTION_ALLOWED) return condition;
  }
  return undefined;
};

/**
 * Whether `status` describes the spec currently stored.
 *
 * `metadata.generation` bumps on every spec write; the controller copies it into
 * `status.observedGeneration` when it has recomputed. Between the two, every number in
 * `status` belongs to the previous selector.
 */
const isStale = (pdb: V1PodDisruptionBudget): boolean => {
  const generation = pdb.metadata?.generation;
  const observed = pdb.status?.observedGeneration;
  if (generation === undefined) return false;
  return observed === undefined || observed < generation;
};

export const getPodDisruptionBudgetStatus = (pdb: V1PodDisruptionBudget): K8sStatus => {
  if (isStale(pdb)) return { status: 'Updating', variant: 'warning' };

  const condition = disruptionCondition(pdb);
  if (!condition) return { status: 'Unknown', variant: 'default' };

  if (condition.status === 'True') return { status: 'Healthy', variant: 'success' };

  if (condition.status === 'False') {
    // `SyncFailed` means the controller could not compute the budget at all, which is a
    // broken PDB. `InsufficientPods` means it computed correctly and the answer is "no
    // disruptions" — that blocks a drain, but it is also the resting state of a
    // single-replica app with `minAvailable: 1`, so it is amber, not red.
    const reason = condition.reason ?? 'Blocked';
    return { status: reason, variant: reason === 'SyncFailed' ? 'error' : 'warning' };
  }

  return { status: condition.status, variant: 'default' };
};

/* -------------------------------------------------------------------------- */
/* Descriptor                                                                 */
/* -------------------------------------------------------------------------- */

export const podDisruptionBudgetsDescriptor = defineResource({
  id: 'podDisruptionBudgets',
  kind: 'PodDisruptionBudget',
  title: 'Pod Disruption Budgets',
  group: 'config',
  icon: ShieldCheck,
  namespaced: true,

  api: {
    list: listPodDisruptionBudgets,
    watch: watchPodDisruptionBudgets,
    remove: deletePodDisruptionBudgets,
    update: updatePodDisruptionBudget,
  },

  status: getPodDisruptionBudgetStatus,

  searchExtra: (pdb: V1PodDisruptionBudget) => [
    // The selector is what ties a PDB to the workload it guards, and it is the only way
    // to find "the budget covering these pods" without opening every one of them.
    ...Object.entries(pdb.spec?.selector?.matchLabels ?? {}).map(
      ([key, value]) => `${key}=${value}`
    ),
    ...Object.entries(pdb.metadata?.labels ?? {}).map(([key, value]) => `${key}=${value}`),
  ],

  columns: [
    {
      id: 'name',
      header: 'Name',
      width: 'minmax(180px, 2.2fr)',
      value: (pdb: V1PodDisruptionBudget) => pdb.metadata?.name,
    },
    {
      id: 'namespace',
      header: 'Namespace',
      width: 'minmax(110px, 1.2fr)',
      value: (pdb: V1PodDisruptionBudget) => pdb.metadata?.namespace,
    },
    {
      id: 'minAvailable',
      header: 'Min available',
      width: '96px',
      align: 'right',
      // `IntOrString`: `3` and `"50%"` are both legal and are returned as they are.
      // `compareValues` sorts numbers numerically and falls back to a numeric-aware
      // string compare, which keeps `9%` before `10%`.
      value: (pdb: V1PodDisruptionBudget) => pdb.spec?.minAvailable,
    },
    {
      id: 'maxUnavailable',
      header: 'Max unavailable',
      width: '108px',
      align: 'right',
      value: (pdb: V1PodDisruptionBudget) => pdb.spec?.maxUnavailable,
    },
    {
      id: 'disruptionsAllowed',
      header: 'Allowed',
      width: '76px',
      align: 'right',
      value: (pdb: V1PodDisruptionBudget) => pdb.status?.disruptionsAllowed,
    },
    {
      id: 'status',
      header: 'Status',
      width: 'minmax(120px, 1.4fr)',
      value: (pdb: V1PodDisruptionBudget) => getPodDisruptionBudgetStatus(pdb).status,
      cell: (pdb: V1PodDisruptionBudget) => {
        const status = getPodDisruptionBudgetStatus(pdb);
        return <StatusBadge status={status.status} variant={status.variant} size="sm" />;
      },
    },
    {
      id: 'age',
      header: 'Age',
      width: '68px',
      align: 'right',
      value: (pdb: V1PodDisruptionBudget) => ageValue(pdb),
      cell: (pdb: V1PodDisruptionBudget) => <AgeCell timestamp={pdb.metadata?.creationTimestamp} />,
    },
  ],

  detail: [
    {
      id: 'metadata',
      title: 'Metadata',
      render: (pdb: V1PodDisruptionBudget) => (
        <DetailGrid>
          <DetailRow label="Name">{pdb.metadata?.name}</DetailRow>
          <DetailRow label="Namespace">{pdb.metadata?.namespace}</DetailRow>
          <DetailRow label="Created">
            <AgeCell timestamp={pdb.metadata?.creationTimestamp} /> ago
          </DetailRow>
          <DetailRow label="Labels">
            <LabelList entries={pdb.metadata?.labels} />
          </DetailRow>
          <DetailRow label="Annotations">
            <LabelList entries={pdb.metadata?.annotations} />
          </DetailRow>
        </DetailGrid>
      ),
    },
    {
      id: 'budget',
      title: 'Budget',
      render: (pdb: V1PodDisruptionBudget) => (
        <DetailGrid>
          <DetailRow label="Min available">{pdb.spec?.minAvailable}</DetailRow>
          <DetailRow label="Max unavailable">{pdb.spec?.maxUnavailable}</DetailRow>
          <DetailRow label="Eviction policy">{pdb.spec?.unhealthyPodEvictionPolicy}</DetailRow>
          <DetailRow label="Selector">
            <LabelList
              entries={pdb.spec?.selector?.matchLabels}
              empty="Every pod in the namespace"
            />
          </DetailRow>
          <Show when={pdb.spec?.selector?.matchExpressions}>
            {(expressions) => (
              <DetailRow label="Expressions">
                <div class="flex flex-col gap-0.5">
                  <For each={expressions()}>
                    {(expression) => (
                      <span class="text-2xs font-mono">
                        {expression.key} {expression.operator} {expression.values?.join(', ') ?? ''}
                      </span>
                    )}
                  </For>
                </div>
              </DetailRow>
            )}
          </Show>
        </DetailGrid>
      ),
    },
    {
      id: 'status',
      title: 'Status',
      render: (pdb: V1PodDisruptionBudget) => (
        <DetailGrid>
          <DetailRow label="Disruptions">{pdb.status?.disruptionsAllowed}</DetailRow>
          <DetailRow label="Current healthy">{pdb.status?.currentHealthy}</DetailRow>
          <DetailRow label="Desired healthy">{pdb.status?.desiredHealthy}</DetailRow>
          <DetailRow label="Expected pods">{pdb.status?.expectedPods}</DetailRow>
          <DetailRow label="Disrupted pods">
            {Object.keys(pdb.status?.disruptedPods ?? {}).join(', ')}
          </DetailRow>
          <Show when={isStale(pdb)}>
            <DetailRow label="Note" class="text-[var(--status-warn)]">
              The controller has not observed the current spec yet; these numbers describe the
              previous one.
            </DetailRow>
          </Show>
        </DetailGrid>
      ),
    },
    {
      id: 'conditions',
      title: 'Conditions',
      render: (pdb: V1PodDisruptionBudget) => (
        <ConditionsTable conditions={pdb.status?.conditions} />
      ),
    },
  ],
});
