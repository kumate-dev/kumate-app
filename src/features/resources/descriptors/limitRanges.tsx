/**
 * LimitRanges.
 *
 * ## The bug this file exists to fix
 *
 * `V1LimitRangeItem` declares the field as **`_default`**, because `default` is a
 * reserved word and the generated client renames it — its `ObjectSerializer` maps the
 * wire name `default` onto `_default` when *it* deserialises a response. Nothing in this
 * app runs that serialiser: payloads arrive as raw JSON from a Tauri command, so the
 * property really is called `default` at runtime and `item._default` is always
 * `undefined`. `PaneLimitRanges` sorted and rendered a `Default` column from
 * `limits[0]?._default` and `SidebarLimitRanges` printed `(item as any)?._default`, so
 * the default limits — the entire reason the object exists — were blank in both places.
 * `defaultLimits` below reads the wire name and falls back to the renamed one.
 *
 * ## Why the columns shrank
 *
 * The React pane had Type / Min / Max / Default / Default Request columns, all read from
 * `spec.limits[0]`. A LimitRange normally has two items (`Pod` and `Container`) with
 * different numbers, so those columns silently described one of them and labelled it as
 * the object's. A LimitRange is a document, not a row: the table identifies it and the
 * panel shows all of it.
 */

import { For, Show, createMemo } from 'solid-js';
import { SlidersHorizontal } from 'lucide-solid';
import type { V1LimitRange, V1LimitRangeItem } from '@kubernetes/client-node';

import {
  deleteLimitRanges,
  listLimitRanges,
  updateLimitRange,
  watchLimitRanges,
} from '@/api/k8s/limitRanges';
import { Badge } from '@/ui/Badge';

import { AgeCell, DetailGrid, DetailRow, LabelList, ageValue } from '../detail-parts';
import { defineResource } from '../types';

/* -------------------------------------------------------------------------- */
/* Limit items                                                                */
/* -------------------------------------------------------------------------- */

type QuantityMap = { [key: string]: string };

const isQuantityMap = (value: unknown): value is QuantityMap =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * The `default` map, read under the name the apiserver actually sends.
 *
 * See the file header. The cast is to a type that *only* adds the wire name, so nothing
 * else about `V1LimitRangeItem` is weakened, and the value is narrowed before use rather
 * than asserted.
 */
const defaultLimits = (item: V1LimitRangeItem): QuantityMap | undefined => {
  const wire: unknown = (item as { default?: unknown }).default;
  if (isQuantityMap(wire)) return wire;
  return item._default;
};

interface LimitField {
  id: string;
  label: string;
  read: (item: V1LimitRangeItem) => QuantityMap | undefined;
}

const LIMIT_FIELDS: readonly LimitField[] = [
  { id: 'min', label: 'Min', read: (item) => item.min },
  { id: 'max', label: 'Max', read: (item) => item.max },
  { id: 'default', label: 'Default', read: defaultLimits },
  { id: 'defaultRequest', label: 'Request', read: (item) => item.defaultRequest },
  { id: 'ratio', label: 'Max ratio', read: (item) => item.maxLimitRequestRatio },
];

/**
 * Only the fields this item actually sets.
 *
 * Almost every LimitRange in the wild sets two of the five, and rendering the other
 * three as columns of em dashes makes the two that matter harder to find, not easier.
 */
const activeFields = (item: V1LimitRangeItem): LimitField[] =>
  LIMIT_FIELDS.filter((field) => {
    const map = field.read(item);
    return map !== undefined && Object.keys(map).length > 0;
  });

/** Every resource named anywhere in the item, so each gets exactly one row. */
const itemResources = (item: V1LimitRangeItem): string[] => {
  const resources = new Set<string>();
  for (const field of LIMIT_FIELDS) {
    for (const resource of Object.keys(field.read(item) ?? {})) resources.add(resource);
  }
  return [...resources].sort((a, b) => a.localeCompare(b));
};

interface LimitItemTableProps {
  item: V1LimitRangeItem;
}

/** One item of `spec.limits`: its type, then a row per resource it constrains. */
function LimitItemTable(props: LimitItemTableProps) {
  const fields = createMemo(() => activeFields(props.item));
  const resources = createMemo(() => itemResources(props.item));

  // The number of columns depends on the data, so the track list cannot be a Tailwind
  // class — there is no way to generate one per possible field combination.
  const template = () => `minmax(0, 1.3fr) repeat(${fields().length}, minmax(0, 1fr))`;

  return (
    <div class="rounded-sm border border-[var(--border-subtle)] bg-[var(--surface-inset)] p-2">
      <div class="mb-1.5 flex items-center gap-2">
        <Badge variant="neutral" size="sm">
          {props.item.type}
        </Badge>
      </div>

      <Show
        when={resources().length > 0 && fields().length > 0}
        fallback={
          <span class="text-2xs text-[var(--text-tertiary)]">
            This item constrains no resources
          </span>
        }
      >
        <div class="flex flex-col divide-y divide-[var(--border-subtle)]">
          <div
            class="text-2xs grid gap-2 pb-1 text-[var(--text-tertiary)]"
            style={{ 'grid-template-columns': template() }}
          >
            <span>Resource</span>
            <For each={fields()}>{(field) => <span class="text-right">{field.label}</span>}</For>
          </div>

          <For each={resources()}>
            {(resource) => (
              <div
                class="text-2xs grid items-baseline gap-2 py-1"
                style={{ 'grid-template-columns': template() }}
              >
                <span class="selectable truncate font-mono text-[var(--code-key)]" title={resource}>
                  {resource}
                </span>
                <For each={fields()}>
                  {(field) => (
                    <Show
                      when={field.read(props.item)?.[resource]}
                      fallback={<span class="text-right text-[var(--text-tertiary)]">—</span>}
                    >
                      {(value) => (
                        <span class="selectable tnum truncate text-right text-[var(--text-primary)]">
                          {value()}
                        </span>
                      )}
                    </Show>
                  )}
                </For>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Descriptor                                                                 */
/* -------------------------------------------------------------------------- */

export const limitRangesDescriptor = defineResource({
  id: 'limitRanges',
  kind: 'LimitRange',
  title: 'Limit Ranges',
  group: 'config',
  icon: SlidersHorizontal,
  namespaced: true,

  api: {
    list: listLimitRanges,
    watch: watchLimitRanges,
    remove: deleteLimitRanges,
    update: updateLimitRange,
  },

  // The item types (`Pod`, `Container`, `PersistentVolumeClaim`) are how anyone looks
  // for one of these, and they are no longer a column.
  searchExtra: (limitRange: V1LimitRange) => [
    ...(limitRange.spec?.limits ?? []).map((item) => item.type),
    ...Object.entries(limitRange.metadata?.labels ?? {}).map(([key, value]) => `${key}=${value}`),
  ],

  columns: [
    {
      id: 'name',
      header: 'Name',
      width: 'minmax(180px, 2.5fr)',
      value: (limitRange: V1LimitRange) => limitRange.metadata?.name,
    },
    {
      id: 'namespace',
      header: 'Namespace',
      width: 'minmax(110px, 1.2fr)',
      value: (limitRange: V1LimitRange) => limitRange.metadata?.namespace,
    },
    {
      id: 'age',
      header: 'Age',
      width: '68px',
      align: 'right',
      value: (limitRange: V1LimitRange) => ageValue(limitRange),
      cell: (limitRange: V1LimitRange) => (
        <AgeCell timestamp={limitRange.metadata?.creationTimestamp} />
      ),
    },
  ],

  detail: [
    {
      id: 'metadata',
      title: 'Metadata',
      render: (limitRange: V1LimitRange) => (
        <DetailGrid>
          <DetailRow label="Name">{limitRange.metadata?.name}</DetailRow>
          <DetailRow label="Namespace">{limitRange.metadata?.namespace}</DetailRow>
          <DetailRow label="Created">
            <AgeCell timestamp={limitRange.metadata?.creationTimestamp} /> ago
          </DetailRow>
          <DetailRow label="Items">{limitRange.spec?.limits?.length ?? 0}</DetailRow>
          <DetailRow label="Labels">
            <LabelList entries={limitRange.metadata?.labels} />
          </DetailRow>
          <DetailRow label="Annotations">
            <LabelList entries={limitRange.metadata?.annotations} />
          </DetailRow>
        </DetailGrid>
      ),
    },
    {
      id: 'limits',
      title: 'Limits',
      render: (limitRange: V1LimitRange) => (
        <Show
          when={(limitRange.spec?.limits ?? []).length > 0}
          fallback={
            <span class="text-2xs text-[var(--text-tertiary)]">This LimitRange sets no limits</span>
          }
        >
          <div class="flex flex-col gap-2">
            <For each={limitRange.spec?.limits}>{(item) => <LimitItemTable item={item} />}</For>
          </div>
        </Show>
      ),
    },
  ],
});
