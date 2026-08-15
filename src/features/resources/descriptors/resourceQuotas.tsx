/**
 * ResourceQuotas.
 *
 * A ResourceQuota is only ever read for one reason: *which limit is about to bite?* The
 * React pane answered it with two columns built by `utils/renderKeyValue.tsx`, each
 * flattening a map into `"limits.cpu: 4, pods: 20, requests.memory: 8Gi"` and then
 * truncating it — so `Hard` and `Used` were two unreadable strings the eye had to
 * re-pair term by term, and sorting either column sorted the *joined text*.
 *
 * Here the pairing is done for us: one row per resource, used and hard side by side,
 * ordered by how close the resource is to its ceiling, with a bar that turns amber and
 * then red. The table itself stays to name/namespace/age, because a fifteen-resource
 * quota does not fit in a table cell and pretending otherwise is what produced the
 * string above.
 *
 * `renderKeyValue` is not ported: this file is its replacement, and every other kind
 * that flattened a map now uses `LabelList` or `KeyValueTable` from `detail-parts`.
 */

import { For, Show, createMemo } from 'solid-js';
import { Gauge } from 'lucide-solid';
import type { V1ResourceQuota } from '@kubernetes/client-node';

import {
  deleteResourceQuotas,
  listResourceQuotas,
  updateResourceQuota,
  watchResourceQuotas,
} from '@/api/k8s/resourceQuotas';
import { parseQuantity } from '@/lib/k8s';
import { Badge, type StatusVariant } from '@/ui/Badge';

import { AgeCell, DetailGrid, DetailRow, LabelList, ageValue } from '../detail-parts';
import { defineResource } from '../types';

/* -------------------------------------------------------------------------- */
/* Usage rows                                                                 */
/* -------------------------------------------------------------------------- */

interface QuotaRow {
  resource: string;
  used: string;
  hard: string;
  /** `used / hard`, or `undefined` when either side is not a parseable quantity. */
  ratio?: number;
}

/**
 * The enforced limits, falling back to what was asked for.
 *
 * `status.hard` is what the quota controller is actually enforcing and is the honest
 * source — but it is absent for the first moment of a quota's life, and the React
 * sidebar read only `status`, so a quota created seconds ago showed an empty panel and
 * looked broken. `spec.hard` is what will be enforced, which is better than nothing.
 */
const hardLimits = (quota: V1ResourceQuota) => quota.status?.hard ?? quota.spec?.hard;

const quotaRows = (quota: V1ResourceQuota): QuotaRow[] => {
  const hard = hardLimits(quota);
  const used = quota.status?.used;

  const rows = Object.entries(hard ?? {}).map(([resource, hardValue]) => {
    const usedValue = used?.[resource];
    const usedNumber = parseQuantity(usedValue);
    const hardNumber = parseQuantity(hardValue);

    let ratio: number | undefined;
    if (usedNumber !== undefined && hardNumber !== undefined) {
      // A hard limit of zero forbids the resource outright: anything used is over
      // budget, nothing used is fine. Dividing by it would give Infinity or NaN.
      ratio = hardNumber === 0 ? (usedNumber > 0 ? 1 : 0) : usedNumber / hardNumber;
    }

    return { resource, used: usedValue ?? '0', hard: hardValue, ratio };
  });

  // Closest to its ceiling first — the whole reason anyone opens this panel. Rows whose
  // quantities could not be parsed sort last rather than to the top as `undefined`.
  return rows.sort(
    (a, b) => (b.ratio ?? -1) - (a.ratio ?? -1) || a.resource.localeCompare(b.resource)
  );
};

/**
 * Thresholds for the bar hue.
 *
 * 85% is where a quota stops being a policy and starts being a pending outage: it is
 * close enough that the next rollout can fail, and far enough that there is time to
 * act. At or over 100% admission is already being rejected, so that is red.
 */
const ratioVariant = (ratio: number): StatusVariant => {
  if (ratio >= 1) return 'danger';
  if (ratio >= 0.85) return 'warn';
  return 'ok';
};

const BAR_TOKEN: Record<StatusVariant, string> = {
  ok: 'var(--status-ok)',
  warn: 'var(--status-warn)',
  danger: 'var(--status-danger)',
  info: 'var(--status-info)',
  neutral: 'var(--text-tertiary)',
  accent: 'var(--accent)',
};

interface QuotaUsageProps {
  quota: V1ResourceQuota;
}

/** One row per quota'd resource: `used / hard`, a percentage and a proportional bar. */
function QuotaUsage(props: QuotaUsageProps) {
  const rows = createMemo(() => quotaRows(props.quota));

  return (
    <Show
      when={rows().length > 0}
      fallback={
        <span class="text-2xs text-[var(--text-tertiary)]">This quota sets no hard limits</span>
      }
    >
      <div class="flex flex-col divide-y divide-[var(--border-subtle)]">
        <For each={rows()}>
          {(row) => (
            <div class="flex flex-col gap-1 py-1.5">
              <div class="flex items-baseline gap-2">
                <span
                  class="selectable text-2xs min-w-0 flex-1 truncate font-mono text-[var(--code-key)]"
                  title={row.resource}
                >
                  {row.resource}
                </span>
                <span class="selectable tnum text-2xs shrink-0 text-[var(--text-primary)]">
                  {row.used} / {row.hard}
                </span>
                {/* Tested against `undefined` rather than truthiness: a resource at 0%
                    of its quota is the healthiest row there is, and `<Show when={0}>`
                    would render it as "unknown". */}
                <Show
                  when={row.ratio !== undefined}
                  fallback={
                    <span class="text-2xs w-10 shrink-0 text-right text-[var(--text-tertiary)]">
                      —
                    </span>
                  }
                >
                  <Badge
                    variant={ratioVariant(row.ratio ?? 0)}
                    size="sm"
                    class="w-10 shrink-0 justify-end"
                  >
                    {Math.round((row.ratio ?? 0) * 100)}%
                  </Badge>
                </Show>
              </div>

              <Show when={row.ratio !== undefined}>
                <div
                  class="h-1 w-full overflow-hidden rounded-full bg-[var(--surface-inset)]"
                  role="presentation"
                >
                  <div
                    class="h-full rounded-full transition-[width]"
                    style={{
                      // Inline because the width is a datum, not a design decision, and
                      // Tailwind cannot generate a class per percentage.
                      width: `${Math.min(100, Math.max(0, (row.ratio ?? 0) * 100))}%`,
                      'background-color': BAR_TOKEN[ratioVariant(row.ratio ?? 0)],
                    }}
                  />
                </div>
              </Show>
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

export const resourceQuotasDescriptor = defineResource({
  id: 'resourceQuotas',
  kind: 'ResourceQuota',
  title: 'Resource Quotas',
  group: 'config',
  icon: Gauge,
  namespaced: true,

  api: {
    list: listResourceQuotas,
    watch: watchResourceQuotas,
    remove: deleteResourceQuotas,
    update: updateResourceQuota,
  },

  // Resource *names* are searchable ("which quota caps `requests.nvidia.com/gpu`?").
  // The values are not: `4` and `8Gi` match everything and nothing.
  searchExtra: (quota: V1ResourceQuota) => [
    ...Object.keys(hardLimits(quota) ?? {}),
    ...(quota.spec?.scopes ?? []),
    ...Object.entries(quota.metadata?.labels ?? {}).map(([key, value]) => `${key}=${value}`),
  ],

  columns: [
    {
      id: 'name',
      header: 'Name',
      width: 'minmax(180px, 2.5fr)',
      value: (quota: V1ResourceQuota) => quota.metadata?.name,
    },
    {
      id: 'namespace',
      header: 'Namespace',
      width: 'minmax(110px, 1.2fr)',
      value: (quota: V1ResourceQuota) => quota.metadata?.namespace,
    },
    {
      id: 'age',
      header: 'Age',
      width: '68px',
      align: 'right',
      value: (quota: V1ResourceQuota) => ageValue(quota),
      cell: (quota: V1ResourceQuota) => <AgeCell timestamp={quota.metadata?.creationTimestamp} />,
    },
  ],

  detail: [
    {
      id: 'usage',
      title: 'Used / hard',
      // First section, ahead of Metadata: it is the only thing on this screen anyone
      // came for.
      render: (quota: V1ResourceQuota) => <QuotaUsage quota={quota} />,
    },
    {
      id: 'metadata',
      title: 'Metadata',
      render: (quota: V1ResourceQuota) => (
        <DetailGrid>
          <DetailRow label="Name">{quota.metadata?.name}</DetailRow>
          <DetailRow label="Namespace">{quota.metadata?.namespace}</DetailRow>
          <DetailRow label="Created">
            <AgeCell timestamp={quota.metadata?.creationTimestamp} /> ago
          </DetailRow>
          <DetailRow label="Scopes">{quota.spec?.scopes?.join(', ')}</DetailRow>
          <DetailRow label="Scope selector">
            <Show when={quota.spec?.scopeSelector?.matchExpressions}>
              {(expressions) => (
                <div class="flex flex-col gap-0.5">
                  <For each={expressions()}>
                    {(expression) => (
                      <span class="text-2xs font-mono">
                        {expression.scopeName} {expression.operator}{' '}
                        {expression.values?.join(', ') ?? ''}
                      </span>
                    )}
                  </For>
                </div>
              )}
            </Show>
          </DetailRow>
          <DetailRow label="Labels">
            <LabelList entries={quota.metadata?.labels} />
          </DetailRow>
          <DetailRow label="Annotations">
            <LabelList entries={quota.metadata?.annotations} />
          </DetailRow>
        </DetailGrid>
      ),
    },
  ],
});
