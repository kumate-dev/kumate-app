/**
 * PriorityClasses. Cluster-scoped.
 *
 * `value` is the whole object: it is the number the scheduler compares when it decides
 * which pod gets evicted so another can be placed, and the ordering of these rows *is*
 * the eviction order of the cluster. So the table sorts on it numerically and descending
 * by default — the classes that win are the ones you need to see first, and a lexical
 * sort would put `2000000000` (`system-node-critical`) between `1000` and `500`.
 *
 * `SidebarPriorityClasses` read `(pc as any).preemptionPolicy` — the field is declared on
 * `V1PriorityClass` and needed no cast; the `any` only turned off the checking that would
 * have caught a typo. It is read normally here, and `description` — which is the one
 * field that explains *why* a class exists and was not shown anywhere in the React UI —
 * is in the panel.
 */

import { ListOrdered } from 'lucide-solid';
import type { V1PriorityClass } from '@kubernetes/client-node';

import {
  deletePriorityClasses,
  listPriorityClasses,
  updatePriorityClass,
  watchPriorityClasses,
} from '@/api/k8s/priorityClasses';
import { Badge } from '@/ui/Badge';

import { AgeCell, DetailGrid, DetailRow, LabelList, ageValue } from '../detail-parts';
import { defineResource } from '../types';

/**
 * `PreemptLowerPriority` is the default the apiserver applies when the field is unset,
 * so an empty cell would read as "no preemption" — the opposite of the truth.
 */
const preemptionPolicy = (priorityClass: V1PriorityClass): string =>
  priorityClass.preemptionPolicy ?? 'PreemptLowerPriority (default)';

export const priorityClassesDescriptor = defineResource({
  id: 'priorityClasses',
  kind: 'PriorityClass',
  title: 'Priority Classes',
  group: 'cluster',
  icon: ListOrdered,
  namespaced: false,

  // Cluster-scoped: `list_priority_classes` and `delete_priority_classes` take no
  // namespace, so these functions accept `{ name }` and `{ name, resourceNames }`. That
  // satisfies `ResourceApi<T>` without a cast — a function may accept fewer properties
  // than its caller passes, so the `namespace` the view supplies for namespaced kinds is
  // simply ignored here.
  api: {
    list: listPriorityClasses,
    watch: watchPriorityClasses,
    remove: deletePriorityClasses,
    update: updatePriorityClass,
  },

  // Descending: the highest priority in the cluster is the interesting end.
  defaultSort: { column: 'value', direction: 'desc' },

  searchExtra: (priorityClass: V1PriorityClass) => [
    priorityClass.description,
    priorityClass.preemptionPolicy,
    ...Object.entries(priorityClass.metadata?.labels ?? {}).map(
      ([key, value]) => `${key}=${value}`
    ),
  ],

  columns: [
    {
      id: 'name',
      header: 'Name',
      width: 'minmax(200px, 2.6fr)',
      value: (priorityClass: V1PriorityClass) => priorityClass.metadata?.name,
    },
    {
      id: 'value',
      header: 'Value',
      width: '110px',
      align: 'right',
      // The raw number, so `compareValues` takes its numeric branch.
      value: (priorityClass: V1PriorityClass) => priorityClass.value,
      cell: (priorityClass: V1PriorityClass) => (
        <span class="tnum">{priorityClass.value.toLocaleString()}</span>
      ),
    },
    {
      id: 'globalDefault',
      header: 'Global default',
      width: '104px',
      // The boolean itself: `String(value)` is what the search box matches against, so
      // typing `true` finds the default class.
      value: (priorityClass: V1PriorityClass) => priorityClass.globalDefault ?? false,
      cell: (priorityClass: V1PriorityClass) =>
        priorityClass.globalDefault ? (
          <Badge variant="accent" size="sm">
            default
          </Badge>
        ) : (
          <span class="text-[var(--text-tertiary)]">—</span>
        ),
    },
    {
      id: 'age',
      header: 'Age',
      width: '68px',
      align: 'right',
      value: (priorityClass: V1PriorityClass) => ageValue(priorityClass),
      cell: (priorityClass: V1PriorityClass) => (
        <AgeCell timestamp={priorityClass.metadata?.creationTimestamp} />
      ),
    },
  ],

  detail: [
    {
      id: 'metadata',
      title: 'Metadata',
      render: (priorityClass: V1PriorityClass) => (
        <DetailGrid>
          <DetailRow label="Name">{priorityClass.metadata?.name}</DetailRow>
          <DetailRow label="Created">
            <AgeCell timestamp={priorityClass.metadata?.creationTimestamp} /> ago
          </DetailRow>
          <DetailRow label="Labels">
            <LabelList entries={priorityClass.metadata?.labels} />
          </DetailRow>
          <DetailRow label="Annotations">
            <LabelList entries={priorityClass.metadata?.annotations} />
          </DetailRow>
        </DetailGrid>
      ),
    },
    {
      id: 'priority',
      title: 'Priority',
      render: (priorityClass: V1PriorityClass) => (
        <DetailGrid>
          <DetailRow label="Value">
            <span class="tnum">{priorityClass.value.toLocaleString()}</span>
          </DetailRow>
          <DetailRow label="Global default">{priorityClass.globalDefault ? 'Yes' : 'No'}</DetailRow>
          <DetailRow label="Preemption">{preemptionPolicy(priorityClass)}</DetailRow>
          <DetailRow label="Description">{priorityClass.description}</DetailRow>
        </DetailGrid>
      ),
    },
  ],
});
