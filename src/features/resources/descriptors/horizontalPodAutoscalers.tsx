/**
 * HorizontalPodAutoscalers.
 *
 * ## Why this file is longer than the other config kinds
 *
 * The backend asks for **autoscaling/v1** (`commands/horizontal_pod_autoscalers.rs`
 * uses `k8s_openapi::api::autoscaling::v1::HorizontalPodAutoscaler`). That version of the
 * type has no `status.conditions` and no `spec.metrics` at all — it carries one CPU
 * target and one CPU reading, and everything else the autoscaler knows is round-tripped
 * through three annotations that the apiserver writes on a v1 read:
 *
 * - `autoscaling.alpha.kubernetes.io/conditions`      → `status.conditions`
 * - `autoscaling.alpha.kubernetes.io/current-metrics` → `status.currentMetrics`
 * - `autoscaling.alpha.kubernetes.io/metrics`         → `spec.metrics` (minus CPU)
 *
 * `utils/horizontalPodAutoscalersStatus.ts` read `(hpa.status as any)?.conditions`, which
 * on a v1 object is **always `undefined`** — the `any` cast is what hid it. Every HPA in
 * the React app therefore showed a grey `Unknown` badge, in every cluster, forever, and
 * the sidebar had no conditions section to contradict it. This file parses the
 * annotations, so the badge says what `kubectl describe hpa` says.
 *
 * FOLLOW-UP: the real fix is one line in the backend — request `autoscaling/v2`, which
 * has `conditions`, `metrics` and `currentMetrics` as typed fields, and delete
 * `hpaExtras` and its cache. It is deliberately not done here because changing the wire
 * type changes what the YAML tab edits and what `update_horizontal_pod_autoscaler`
 * accepts, which is a backend change with its own tests.
 */

import { For, Show, createMemo } from 'solid-js';
import { TrendingUp } from 'lucide-solid';
import type { V1HorizontalPodAutoscaler } from '@kubernetes/client-node';

import {
  deleteHorizontalPodAutoscalers,
  listHorizontalPodAutoscalers,
  updateHorizontalPodAutoscaler,
  watchHorizontalPodAutoscalers,
} from '@/api/k8s/horizontalPodAutoscalers';
import type { K8sStatus } from '@/types/k8sStatus';
import { StatusBadge } from '@/ui/StatusBadge';

import {
  AgeCell,
  ConditionsTable,
  DetailGrid,
  DetailRow,
  LabelList,
  ageValue,
  type K8sCondition,
} from '../detail-parts';
import { defineResource } from '../types';

/* -------------------------------------------------------------------------- */
/* Annotation payloads                                                        */
/* -------------------------------------------------------------------------- */

const CONDITIONS_ANNOTATION = 'autoscaling.alpha.kubernetes.io/conditions';
const CURRENT_METRICS_ANNOTATION = 'autoscaling.alpha.kubernetes.io/current-metrics';
const METRICS_ANNOTATION = 'autoscaling.alpha.kubernetes.io/metrics';

/**
 * Narrowing helpers for JSON that arrived as a string.
 *
 * The annotations are written by the apiserver, but they are still text in a map that
 * anyone can `kubectl annotate` over, so every field is checked rather than asserted.
 * `no-explicit-any` would let a cast through here; a malformed annotation would then
 * throw inside a column accessor and take the table down with it.
 */
const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const asString = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : undefined;

const asNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const parseJson = (raw: string | undefined): unknown => {
  if (raw === undefined || raw === '') return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    // A hand-edited annotation is a plausible accident and must not break the row.
    return undefined;
  }
};

/** One metric, paired with its current reading. */
interface MetricSummary {
  /** `cpu`, `memory`, `requests-per-second on Ingress/web`, … */
  name: string;
  current?: string;
  target?: string;
}

interface HpaExtras {
  conditions: K8sCondition[];
  metrics: MetricSummary[];
}

const NO_EXTRAS: HpaExtras = { conditions: [], metrics: [] };

const parseConditions = (raw: unknown): K8sCondition[] => {
  if (!Array.isArray(raw)) return [];

  const conditions: K8sCondition[] = [];
  for (const entry of raw) {
    const record = asRecord(entry);
    const type = asString(record?.type);
    const status = asString(record?.status);
    // Both are required by the condition contract; anything missing them is not one.
    if (type === undefined || status === undefined) continue;

    conditions.push({
      type,
      status,
      reason: asString(record?.reason),
      message: asString(record?.message),
      lastTransitionTime: asString(record?.lastTransitionTime),
    });
  }
  return conditions;
};

/**
 * The metric's identity, built the way `kubectl` labels it.
 *
 * `type` selects which sibling field carries the metric, so the name lives in a
 * different place for each of the five kinds.
 */
const metricName = (metric: Record<string, unknown>): string | undefined => {
  const type = asString(metric.type);

  switch (type) {
    case 'Resource':
      return asString(asRecord(metric.resource)?.name);
    case 'ContainerResource': {
      const source = asRecord(metric.containerResource);
      const resource = asString(source?.name);
      const container = asString(source?.container);
      if (resource === undefined) return undefined;
      return container === undefined ? resource : `${resource} in ${container}`;
    }
    case 'Pods':
      return asString(asRecord(asRecord(metric.pods)?.metric)?.name);
    case 'Object': {
      const source = asRecord(metric.object);
      const name = asString(asRecord(source?.metric)?.name);
      const described = asRecord(source?.describedObject);
      const kind = asString(described?.kind);
      const objectName = asString(described?.name);
      if (name === undefined) return undefined;
      return kind && objectName ? `${name} on ${kind}/${objectName}` : name;
    }
    case 'External':
      return asString(asRecord(asRecord(metric.external)?.metric)?.name);
    default:
      return type;
  }
};

/** The sub-object holding `target` / `current` for whichever kind this metric is. */
const metricSource = (metric: Record<string, unknown>): Record<string, unknown> | undefined => {
  const type = asString(metric.type);
  switch (type) {
    case 'Resource':
      return asRecord(metric.resource);
    case 'ContainerResource':
      return asRecord(metric.containerResource);
    case 'Pods':
      return asRecord(metric.pods);
    case 'Object':
      return asRecord(metric.object);
    case 'External':
      return asRecord(metric.external);
    default:
      return undefined;
  }
};

/**
 * A `MetricTarget` or `MetricValueStatus` as one short string.
 *
 * Utilisation is a percentage; everything else is already a `Quantity` and is shown
 * verbatim, because rewriting `1500m` as `1.5` loses the unit the user wrote.
 */
const formatMetricValue = (value: Record<string, unknown> | undefined): string | undefined => {
  if (value === undefined) return undefined;

  const utilization = asNumber(value.averageUtilization);
  if (utilization !== undefined) return `${utilization}%`;

  return asString(value.averageValue) ?? asString(value.value);
};

const parseMetrics = (specRaw: unknown, statusRaw: unknown): MetricSummary[] => {
  const specs = Array.isArray(specRaw) ? specRaw : [];
  const currents = Array.isArray(statusRaw) ? statusRaw : [];

  // Keyed by identity rather than paired by index: the two annotations are written
  // independently, and a metric the autoscaler could not read yet is absent from
  // `current-metrics` — pairing by position would then attribute one metric's reading to
  // the next metric's target, which is worse than showing no reading at all.
  const readings = new Map<string, string>();
  for (const entry of currents) {
    const record = asRecord(entry);
    if (!record) continue;
    const name = metricName(record);
    const current = formatMetricValue(asRecord(metricSource(record)?.current));
    if (name !== undefined && current !== undefined) readings.set(name, current);
  }

  const metrics: MetricSummary[] = [];
  for (const entry of specs) {
    const record = asRecord(entry);
    if (!record) continue;
    const name = metricName(record);
    if (name === undefined) continue;

    metrics.push({
      name,
      target: formatMetricValue(asRecord(metricSource(record)?.target)),
      current: readings.get(name),
    });
  }

  // A reading with no matching spec entry still says something ("this is what I see"),
  // and dropping it would make the panel disagree with `kubectl describe`.
  for (const [name, current] of readings) {
    if (!metrics.some((metric) => metric.name === name)) metrics.push({ name, current });
  }

  return metrics;
};

/**
 * Parsed annotations, cached per object.
 *
 * `getHorizontalPodAutoscalerStatus` is a column accessor: it runs per row per
 * comparison, and `JSON.parse` there would be exactly the allocation the column contract
 * forbids. The cache is keyed on the object *and* on the raw annotation text, because
 * `createResourceList` applies watch events with `reconcile`, which mutates the existing
 * object in place — identity alone would hand back a stale parse for an HPA whose
 * conditions had just changed. A `WeakMap` so a deleted HPA's entry is collectable.
 */
const EXTRAS_CACHE = new WeakMap<V1HorizontalPodAutoscaler, { raw: string; extras: HpaExtras }>();

const hpaExtras = (hpa: V1HorizontalPodAutoscaler): HpaExtras => {
  const annotations = hpa.metadata?.annotations;
  if (!annotations) return NO_EXTRAS;

  const conditionsRaw = annotations[CONDITIONS_ANNOTATION];
  const currentRaw = annotations[CURRENT_METRICS_ANNOTATION];
  const metricsRaw = annotations[METRICS_ANNOTATION];
  if (conditionsRaw === undefined && currentRaw === undefined && metricsRaw === undefined) {
    return NO_EXTRAS;
  }

  // Concatenated with a separator that cannot appear in JSON, so the comparison cannot
  // be fooled by content moving between the three annotations.
  const raw = `${conditionsRaw ?? ''}\u0000${currentRaw ?? ''}\u0000${metricsRaw ?? ''}`;

  const cached = EXTRAS_CACHE.get(hpa);
  if (cached && cached.raw === raw) return cached.extras;

  const extras: HpaExtras = {
    conditions: parseConditions(parseJson(conditionsRaw)),
    metrics: parseMetrics(parseJson(metricsRaw), parseJson(currentRaw)),
  };

  EXTRAS_CACHE.set(hpa, { raw, extras });
  return extras;
};

/* -------------------------------------------------------------------------- */
/* Metrics                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Every metric this HPA scales on, CPU first.
 *
 * The v1 conversion keeps the CPU resource metric in the typed
 * `targetCPUUtilizationPercentage` / `currentCPUUtilizationPercentage` fields and puts
 * only the *other* metrics in the annotation, so a complete list has to read both. This
 * is why a CPU-only HPA has no `metrics` annotation and reading only the annotation
 * would show nothing at all.
 */
const metricSummaries = (hpa: V1HorizontalPodAutoscaler): MetricSummary[] => {
  const target = hpa.spec?.targetCPUUtilizationPercentage;
  const extras = hpaExtras(hpa).metrics;
  if (target === undefined) return extras;

  const current = hpa.status?.currentCPUUtilizationPercentage;
  return [
    {
      name: 'cpu',
      target: `${target}%`,
      current: current === undefined ? undefined : `${current}%`,
    },
    ...extras,
  ];
};

/** `cpu: 42%/80%`, joined — the TARGETS column of `kubectl get hpa`. */
const metricsText = (hpa: V1HorizontalPodAutoscaler): string => {
  const metrics = metricSummaries(hpa);
  if (metrics.length === 0) return '—';
  return metrics
    .map((metric) => `${metric.name}: ${metric.current ?? '<unknown>'}/${metric.target ?? '—'}`)
    .join(', ');
};

/* -------------------------------------------------------------------------- */
/* Status                                                                     */
/* -------------------------------------------------------------------------- */

const conditionOf = (conditions: readonly K8sCondition[], type: string) => {
  for (const condition of conditions) {
    if (condition.type === type) return condition;
  }
  return undefined;
};

/**
 * What the autoscaler is doing, in one word.
 *
 * Order of precedence, and why each step is where it is:
 *
 * 1. `ScalingActive=False` is the failure that matters — the controller cannot read the
 *    metric (`FailedGetResourceMetric`), so the HPA is inert while looking configured.
 *    The React helper could reach this branch only if `AbleToScale` happened to come
 *    *after* it in the array, and it never does: the apiserver emits `AbleToScale`
 *    first, so `AbleToScale=True` won the loop and a blind autoscaler reported green.
 * 2. `AbleToScale=False` is a scale subresource problem (missing target, failed update).
 * 3. `ScalingLimited=True` is reported only when the clamp is the *upper* bound. At the
 *    lower bound it is the normal resting state of every idle HPA in the cluster —
 *    `reason: TooFewReplicas` — and badging that amber would make the column noise.
 * 4. With no usable conditions, a CPU reading still proves the controller is working;
 *    that is the only inference made here, and it is why a v1-native HPA whose
 *    annotations are absent does not read `Unknown`.
 */
export const getHorizontalPodAutoscalerStatus = (hpa: V1HorizontalPodAutoscaler): K8sStatus => {
  const conditions = hpaExtras(hpa).conditions;

  const scalingActive = conditionOf(conditions, 'ScalingActive');
  if (scalingActive?.status === 'False') {
    return { status: scalingActive.reason ?? 'ScalingInactive', variant: 'error' };
  }

  const ableToScale = conditionOf(conditions, 'AbleToScale');
  if (ableToScale?.status === 'False') {
    return { status: ableToScale.reason ?? 'UnableToScale', variant: 'error' };
  }

  const limited = conditionOf(conditions, 'ScalingLimited');
  if (limited?.status === 'True' && limited.reason === 'TooManyReplicas') {
    return { status: 'AtMaxReplicas', variant: 'warning' };
  }

  if (scalingActive?.status === 'True' || ableToScale?.status === 'True') {
    return { status: 'Active', variant: 'success' };
  }

  if (hpa.status?.currentCPUUtilizationPercentage !== undefined) {
    return { status: 'Active', variant: 'success' };
  }

  return { status: 'Unknown', variant: 'default' };
};

/* -------------------------------------------------------------------------- */
/* Detail                                                                     */
/* -------------------------------------------------------------------------- */

const targetRef = (hpa: V1HorizontalPodAutoscaler): string | undefined => {
  const ref = hpa.spec?.scaleTargetRef;
  if (!ref?.name) return undefined;
  return `${ref.kind}/${ref.name}`;
};

interface MetricsTableProps {
  hpa: V1HorizontalPodAutoscaler;
}

/** Current vs target, one row per metric. */
function MetricsTable(props: MetricsTableProps) {
  const metrics = createMemo(() => metricSummaries(props.hpa));

  return (
    <Show
      when={metrics().length > 0}
      fallback={
        <span class="text-2xs text-[var(--text-tertiary)]">
          No metrics are configured on this autoscaler
        </span>
      }
    >
      <div class="flex flex-col divide-y divide-[var(--border-subtle)]">
        <div class="text-2xs grid grid-cols-[minmax(0,1fr)_72px_72px] gap-2 pb-1 text-[var(--text-tertiary)]">
          <span>Metric</span>
          <span class="text-right">Current</span>
          <span class="text-right">Target</span>
        </div>
        <For each={metrics()}>
          {(metric) => (
            <div class="text-2xs grid grid-cols-[minmax(0,1fr)_72px_72px] items-baseline gap-2 py-1">
              <span
                class="selectable truncate font-mono text-[var(--code-key)]"
                title={metric.name}
              >
                {metric.name}
              </span>
              <span class="selectable tnum truncate text-right text-[var(--text-primary)]">
                {metric.current ?? '—'}
              </span>
              <span class="selectable tnum truncate text-right text-[var(--text-secondary)]">
                {metric.target ?? '—'}
              </span>
            </div>
          )}
        </For>
      </div>
    </Show>
  );
}

/* -------------------------------------------------------------------------- */
/* Descriptor                                                                 */
/* -------------------------------------------------------------------------- */

export const horizontalPodAutoscalersDescriptor = defineResource({
  id: 'horizontalPodAutoscalers',
  kind: 'HorizontalPodAutoscaler',
  title: 'Horizontal Pod Autoscalers',
  group: 'config',
  icon: TrendingUp,
  namespaced: true,

  api: {
    list: listHorizontalPodAutoscalers,
    watch: watchHorizontalPodAutoscalers,
    remove: deleteHorizontalPodAutoscalers,
    update: updateHorizontalPodAutoscaler,
  },

  status: getHorizontalPodAutoscalerStatus,

  searchExtra: (hpa: V1HorizontalPodAutoscaler) => [
    hpa.spec?.scaleTargetRef?.kind,
    hpa.spec?.scaleTargetRef?.name,
    ...Object.entries(hpa.metadata?.labels ?? {}).map(([key, value]) => `${key}=${value}`),
  ],

  columns: [
    {
      id: 'name',
      header: 'Name',
      width: 'minmax(180px, 2.2fr)',
      value: (hpa: V1HorizontalPodAutoscaler) => hpa.metadata?.name,
    },
    {
      id: 'namespace',
      header: 'Namespace',
      width: 'minmax(110px, 1.2fr)',
      value: (hpa: V1HorizontalPodAutoscaler) => hpa.metadata?.namespace,
    },
    {
      id: 'target',
      header: 'Target',
      width: 'minmax(140px, 1.8fr)',
      // The bare name, not `Kind/name`: the accessor runs per row per comparison and
      // must not build a string. The cell prints the kind, where allocating once per
      // visible row is free.
      value: (hpa: V1HorizontalPodAutoscaler) => hpa.spec?.scaleTargetRef?.name,
      cell: (hpa: V1HorizontalPodAutoscaler) => (
        <span class="truncate" title={targetRef(hpa)}>
          {targetRef(hpa)}
        </span>
      ),
    },
    {
      id: 'metrics',
      header: 'Metrics',
      width: 'minmax(140px, 2fr)',
      // Sorted by current CPU utilisation — "which autoscaler is hottest" — because that
      // is the one number available without parsing an annotation. The cell text is the
      // full list; it is not sortable text and must not be, see `hpaExtras`.
      value: (hpa: V1HorizontalPodAutoscaler) => hpa.status?.currentCPUUtilizationPercentage,
      cell: (hpa: V1HorizontalPodAutoscaler) => {
        const text = metricsText(hpa);
        return (
          <span class="tnum truncate" title={text}>
            {text}
          </span>
        );
      },
    },
    {
      id: 'minReplicas',
      header: 'Min',
      width: '52px',
      align: 'right',
      value: (hpa: V1HorizontalPodAutoscaler) => hpa.spec?.minReplicas,
    },
    {
      id: 'maxReplicas',
      header: 'Max',
      width: '52px',
      align: 'right',
      value: (hpa: V1HorizontalPodAutoscaler) => hpa.spec?.maxReplicas,
    },
    {
      id: 'replicas',
      header: 'Replicas',
      width: '72px',
      align: 'right',
      value: (hpa: V1HorizontalPodAutoscaler) => hpa.status?.currentReplicas,
    },
    {
      id: 'status',
      header: 'Status',
      width: 'minmax(120px, 1.4fr)',
      value: (hpa: V1HorizontalPodAutoscaler) => getHorizontalPodAutoscalerStatus(hpa).status,
      cell: (hpa: V1HorizontalPodAutoscaler) => {
        const status = getHorizontalPodAutoscalerStatus(hpa);
        return <StatusBadge status={status.status} variant={status.variant} size="sm" />;
      },
    },
    {
      id: 'age',
      header: 'Age',
      width: '68px',
      align: 'right',
      value: (hpa: V1HorizontalPodAutoscaler) => ageValue(hpa),
      cell: (hpa: V1HorizontalPodAutoscaler) => (
        <AgeCell timestamp={hpa.metadata?.creationTimestamp} />
      ),
    },
  ],

  detail: [
    {
      id: 'metadata',
      title: 'Metadata',
      render: (hpa: V1HorizontalPodAutoscaler) => (
        <DetailGrid>
          <DetailRow label="Name">{hpa.metadata?.name}</DetailRow>
          <DetailRow label="Namespace">{hpa.metadata?.namespace}</DetailRow>
          <DetailRow label="Created">
            <AgeCell timestamp={hpa.metadata?.creationTimestamp} /> ago
          </DetailRow>
          <DetailRow label="Labels">
            <LabelList entries={hpa.metadata?.labels} />
          </DetailRow>
          <DetailRow label="Annotations">
            <LabelList entries={hpa.metadata?.annotations} />
          </DetailRow>
        </DetailGrid>
      ),
    },
    {
      id: 'scaling',
      title: 'Scaling',
      render: (hpa: V1HorizontalPodAutoscaler) => (
        <DetailGrid>
          <DetailRow label="Target">{targetRef(hpa)}</DetailRow>
          <DetailRow label="Min replicas">{hpa.spec?.minReplicas ?? 1}</DetailRow>
          <DetailRow label="Max replicas">{hpa.spec?.maxReplicas}</DetailRow>
          <DetailRow label="Current">{hpa.status?.currentReplicas}</DetailRow>
          <DetailRow label="Desired">{hpa.status?.desiredReplicas}</DetailRow>
          <DetailRow label="Last scaled">
            <Show when={hpa.status?.lastScaleTime}>
              {(timestamp) => (
                <>
                  <AgeCell timestamp={timestamp()} /> ago
                </>
              )}
            </Show>
          </DetailRow>
        </DetailGrid>
      ),
    },
    {
      id: 'metrics',
      title: 'Metrics',
      render: (hpa: V1HorizontalPodAutoscaler) => <MetricsTable hpa={hpa} />,
    },
    {
      id: 'conditions',
      title: 'Conditions',
      render: (hpa: V1HorizontalPodAutoscaler) => (
        <ConditionsTable
          conditions={hpaExtras(hpa).conditions}
          // Named precisely: on autoscaling/v1 an empty list means the annotation is
          // missing, which is not the same as an autoscaler that has reported nothing.
          empty="No conditions on this object"
        />
      ),
    },
  ],
});
