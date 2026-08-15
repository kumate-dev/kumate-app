/**
 * RuntimeClasses. Cluster-scoped.
 *
 * Three fields, and the two that are not the handler are the ones that surprise people:
 * `overhead.podFixed` is silently added to every pod's resource requests — so a
 * RuntimeClass can make a scheduler decision look wrong until you find it — and
 * `scheduling` restricts which nodes may run those pods at all.
 *
 * `PaneRuntimeClasses` had both as columns, flattening each map into a truncated
 * `key: value, …` string, and `SidebarRuntimeClasses` showed `scheduling.nodeSelector`
 * but never `scheduling.tolerations`, which is the half that *adds* reachable nodes. The
 * table keeps to what identifies a class; the panel shows both halves in full.
 */

import { For, Show } from 'solid-js';
import { Cpu } from 'lucide-solid';
import type { V1RuntimeClass, V1Toleration } from '@kubernetes/client-node';

import {
  deleteRuntimeClasses,
  listRuntimeClasses,
  updateRuntimeClass,
  watchRuntimeClasses,
} from '@/api/k8s/runtimeClasses';

import {
  AgeCell,
  DetailGrid,
  DetailRow,
  KeyValueTable,
  LabelList,
  ageValue,
  type KeyValueEntry,
} from '../detail-parts';
import { defineResource } from '../types';

/**
 * A toleration in the notation `kubectl describe` uses.
 *
 * `Exists` has no value and printing `key= :NoSchedule` for it would read as an empty
 * string value, which means something different.
 */
const tolerationText = (toleration: V1Toleration): string => {
  const key = toleration.key ?? '*';
  const operator = toleration.operator ?? 'Equal';
  const head = operator === 'Exists' ? `${key} exists` : `${key}=${toleration.value ?? ''}`;
  const effect = toleration.effect ? `:${toleration.effect}` : ' (all effects)';
  const seconds =
    toleration.tolerationSeconds === undefined ? '' : ` for ${toleration.tolerationSeconds}s`;
  return `${head}${effect}${seconds}`;
};

const overheadEntries = (runtimeClass: V1RuntimeClass): KeyValueEntry[] =>
  Object.entries(runtimeClass.overhead?.podFixed ?? {})
    .map(([key, value]) => ({ key, value: () => value }))
    .sort((a, b) => a.key.localeCompare(b.key));

export const runtimeClassesDescriptor = defineResource({
  id: 'runtimeClasses',
  kind: 'RuntimeClass',
  title: 'Runtime Classes',
  group: 'cluster',
  icon: Cpu,
  namespaced: false,

  // Cluster-scoped: `list_runtime_classes` and `delete_runtime_classes` take no
  // namespace, so these accept `{ name }` and `{ name, resourceNames }`. Assignable to
  // `ResourceApi<T>` as they are — see the equivalent note in `priorityClasses.tsx`.
  api: {
    list: listRuntimeClasses,
    watch: watchRuntimeClasses,
    remove: deleteRuntimeClasses,
    update: updateRuntimeClass,
  },

  searchExtra: (runtimeClass: V1RuntimeClass) => [
    runtimeClass.handler,
    ...Object.keys(runtimeClass.scheduling?.nodeSelector ?? {}),
    ...Object.entries(runtimeClass.metadata?.labels ?? {}).map(([key, value]) => `${key}=${value}`),
  ],

  columns: [
    {
      id: 'name',
      header: 'Name',
      width: 'minmax(200px, 2.6fr)',
      value: (runtimeClass: V1RuntimeClass) => runtimeClass.metadata?.name,
    },
    {
      id: 'handler',
      header: 'Handler',
      width: 'minmax(140px, 2fr)',
      value: (runtimeClass: V1RuntimeClass) => runtimeClass.handler,
      cell: (runtimeClass: V1RuntimeClass) => (
        <span class="truncate font-mono" title={runtimeClass.handler}>
          {runtimeClass.handler}
        </span>
      ),
    },
    {
      id: 'age',
      header: 'Age',
      width: '68px',
      align: 'right',
      value: (runtimeClass: V1RuntimeClass) => ageValue(runtimeClass),
      cell: (runtimeClass: V1RuntimeClass) => (
        <AgeCell timestamp={runtimeClass.metadata?.creationTimestamp} />
      ),
    },
  ],

  detail: [
    {
      id: 'metadata',
      title: 'Metadata',
      render: (runtimeClass: V1RuntimeClass) => (
        <DetailGrid>
          <DetailRow label="Name">{runtimeClass.metadata?.name}</DetailRow>
          <DetailRow label="Handler">
            <span class="font-mono">{runtimeClass.handler}</span>
          </DetailRow>
          <DetailRow label="Created">
            <AgeCell timestamp={runtimeClass.metadata?.creationTimestamp} /> ago
          </DetailRow>
          <DetailRow label="Labels">
            <LabelList entries={runtimeClass.metadata?.labels} />
          </DetailRow>
          <DetailRow label="Annotations">
            <LabelList entries={runtimeClass.metadata?.annotations} />
          </DetailRow>
        </DetailGrid>
      ),
    },
    {
      id: 'overhead',
      title: 'Overhead',
      render: (runtimeClass: V1RuntimeClass) => (
        <div class="flex flex-col gap-1.5">
          <p class="text-2xs text-[var(--text-tertiary)]">
            Added to the resource requests of every pod using this class.
          </p>
          <KeyValueTable
            entries={overheadEntries(runtimeClass)}
            empty="This class declares no overhead"
          />
        </div>
      ),
    },
    {
      id: 'scheduling',
      title: 'Scheduling',
      render: (runtimeClass: V1RuntimeClass) => (
        <DetailGrid>
          <DetailRow label="Node selector">
            <LabelList
              entries={runtimeClass.scheduling?.nodeSelector}
              empty="Any node may run this class"
            />
          </DetailRow>
          <DetailRow label="Tolerations">
            <Show when={(runtimeClass.scheduling?.tolerations ?? []).length > 0}>
              <div class="flex flex-col gap-0.5">
                <For each={runtimeClass.scheduling?.tolerations}>
                  {(toleration) => (
                    <span class="text-2xs font-mono break-all">{tolerationText(toleration)}</span>
                  )}
                </For>
              </div>
            </Show>
          </DetailRow>
        </DetailGrid>
      ),
    },
  ],
});
