/**
 * StorageClasses. Cluster-scoped.
 *
 * ## What the React screen got wrong
 *
 * - **`(sc as any).reclaimPolicy`, in both the pane and the sidebar.** `V1StorageClass`
 *   declares `reclaimPolicy` perfectly well; the cast was pure noise, and — unlike the
 *   `_default` and `_from` renames elsewhere in this API — it was hiding nothing at all.
 *   Removed rather than reproduced: an `any` that turns out to be unnecessary is worse
 *   than one that is, because it teaches the next reader that the field is untyped.
 * - **The default class was invisible.** Which class is the default is not a field but
 *   the annotation `storageclass.kubernetes.io/is-default-class` being the string
 *   `"true"`, and it decides where every PVC created without a `storageClassName` is
 *   provisioned. Neither screen showed it.
 * - **`allowedTopologies` was not shown anywhere.** It restricts which zones a volume may
 *   be provisioned in, and a PVC that cannot be satisfied in any allowed zone stays
 *   `Pending` with the reason on an Event nobody looks at.
 *
 * The panel also names the consequence of `volumeBindingMode: WaitForFirstConsumer`,
 * because "my PVC is stuck in Pending" is almost always this working as designed.
 */

import { For, Show } from 'solid-js';
import { Boxes } from 'lucide-solid';
import type { V1StorageClass } from '@kubernetes/client-node';

import {
  deleteStorageClasses,
  listStorageClasses,
  updateStorageClass,
  watchStorageClasses,
} from '@/api/k8s/storageClasses';
import { Badge } from '@/ui/Badge';
import { Tooltip } from '@/ui/Tooltip';

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

/** One shared empty array for the `?? []` defaults. */
const EMPTY = [] as const;

const DEFAULT_ANNOTATION = 'storageclass.kubernetes.io/is-default-class';

/**
 * Whether PVCs that name no class are provisioned by this one.
 *
 * The annotation is a *string*: only the exact value `"true"` counts, so this cannot be a
 * truthiness check — `"false"` is a non-empty string too.
 */
const isDefault = (storageClass: V1StorageClass): boolean =>
  storageClass.metadata?.annotations?.[DEFAULT_ANNOTATION] === 'true';

/**
 * The reclaim policy applied to volumes this class provisions.
 *
 * The apiserver defaults it to `Delete`, which is worth spelling out rather than leaving
 * blank: a class with no reclaim policy destroys data when the claim goes away, and an
 * empty cell reads like the safer option.
 */
const reclaimPolicy = (storageClass: V1StorageClass): string =>
  storageClass.reclaimPolicy ?? 'Delete';

/** `Immediate` is the API default. */
const bindingMode = (storageClass: V1StorageClass): string =>
  storageClass.volumeBindingMode ?? 'Immediate';

const parameterEntries = (storageClass: V1StorageClass): KeyValueEntry[] =>
  Object.entries(storageClass.parameters ?? {})
    .map(([key, value]) => ({ key, value: () => value }))
    .sort((a, b) => a.key.localeCompare(b.key));

/**
 * `topology.kubernetes.io/zone in (eu-west-1a, eu-west-1b)` per requirement.
 *
 * A term is a *conjunction* of its requirements and the list of terms is a disjunction,
 * so the terms are kept apart rather than flattened into one line.
 */
const topologyTerms = (storageClass: V1StorageClass): string[][] =>
  (storageClass.allowedTopologies ?? EMPTY).map((term) =>
    (term.matchLabelExpressions ?? EMPTY).map(
      (expression) => `${expression.key} in (${expression.values.join(', ')})`
    )
  );

export const storageClassesDescriptor = defineResource({
  id: 'storageClasses',
  kind: 'StorageClass',
  title: 'Storage Classes',
  group: 'storage',
  icon: Boxes,
  namespaced: false,

  // Cluster-scoped: `list_storage_classes` and `delete_storage_classes` take no
  // namespace, so these accept `{ name }` and `{ name, resourceNames }`.
  api: {
    list: listStorageClasses,
    watch: watchStorageClasses,
    remove: deleteStorageClasses,
    update: updateStorageClass,
  },

  searchExtra: (storageClass: V1StorageClass) => [
    storageClass.provisioner,
    ...Object.keys(storageClass.parameters ?? {}),
    ...Object.entries(storageClass.metadata?.labels ?? {}).map(([key, value]) => `${key}=${value}`),
  ],

  columns: [
    {
      id: 'name',
      header: 'Name',
      width: 'minmax(160px, 2fr)',
      value: (storageClass: V1StorageClass) => storageClass.metadata?.name,
    },
    {
      id: 'provisioner',
      header: 'Provisioner',
      width: 'minmax(180px, 2.6fr)',
      value: (storageClass: V1StorageClass) => storageClass.provisioner,
      cell: (storageClass: V1StorageClass) => (
        <span class="truncate font-mono" title={storageClass.provisioner}>
          {storageClass.provisioner}
        </span>
      ),
    },
    {
      id: 'reclaimPolicy',
      header: 'Reclaim',
      width: '88px',
      value: (storageClass: V1StorageClass) => reclaimPolicy(storageClass),
    },
    {
      id: 'bindingMode',
      header: 'Binding mode',
      width: '132px',
      value: (storageClass: V1StorageClass) => bindingMode(storageClass),
      cell: (storageClass: V1StorageClass) => (
        <Show
          when={bindingMode(storageClass) === 'WaitForFirstConsumer'}
          fallback={<span class="truncate">{bindingMode(storageClass)}</span>}
        >
          <Tooltip content="Volumes are provisioned only once a pod using the claim is scheduled, so claims of this class stay Pending until then.">
            <span class="truncate">WaitForFirstConsumer</span>
          </Tooltip>
        </Show>
      ),
    },
    {
      id: 'expansion',
      header: 'Expansion',
      width: '88px',
      // `undefined` and `false` mean the same thing here, so both sort together as `false`
      // rather than splitting into two groups.
      value: (storageClass: V1StorageClass) => storageClass.allowVolumeExpansion === true,
      cell: (storageClass: V1StorageClass) => (
        <span class={storageClass.allowVolumeExpansion ? undefined : 'text-[var(--text-tertiary)]'}>
          {storageClass.allowVolumeExpansion ? 'Yes' : 'No'}
        </span>
      ),
    },
    {
      id: 'default',
      header: 'Default',
      width: '84px',
      value: (storageClass: V1StorageClass) => isDefault(storageClass),
      cell: (storageClass: V1StorageClass) => (
        <Show
          when={isDefault(storageClass)}
          fallback={<span class="text-[var(--text-tertiary)]">—</span>}
        >
          <Badge variant="accent" size="sm">
            default
          </Badge>
        </Show>
      ),
    },
    {
      id: 'age',
      header: 'Age',
      width: '68px',
      align: 'right',
      value: (storageClass: V1StorageClass) => ageValue(storageClass),
      cell: (storageClass: V1StorageClass) => (
        <AgeCell timestamp={storageClass.metadata?.creationTimestamp} />
      ),
    },
  ],

  detail: [
    {
      id: 'provisioning',
      title: 'Provisioning',
      render: (storageClass: V1StorageClass) => (
        <DetailGrid>
          <DetailRow label="Provisioner">
            <span class="font-mono">{storageClass.provisioner}</span>
          </DetailRow>
          <DetailRow label="Default">
            <Show when={isDefault(storageClass)} fallback="No">
              Yes — claims that name no storage class are provisioned by this one
            </Show>
          </DetailRow>
          <DetailRow label="Reclaim policy">
            {reclaimPolicy(storageClass)}
            <Show when={storageClass.reclaimPolicy === undefined}>
              <span class="text-[var(--text-tertiary)]"> (API default)</span>
            </Show>
          </DetailRow>
          <DetailRow label="Binding mode">
            {bindingMode(storageClass)}
            <Show when={bindingMode(storageClass) === 'WaitForFirstConsumer'}>
              {/* The single most common cause of a PVC that "will not bind". Spelled out
                  because the claim itself gives no hint that the wait is deliberate. */}
              <span class="text-2xs block text-[var(--text-tertiary)]">
                Claims stay Pending until a pod that uses them is scheduled.
              </span>
            </Show>
          </DetailRow>
          <DetailRow label="Volume expansion">
            {storageClass.allowVolumeExpansion ? 'Allowed' : 'Not allowed'}
          </DetailRow>
          <DetailRow label="Mount options">
            <Show when={(storageClass.mountOptions ?? EMPTY).length > 0}>
              <span class="text-2xs font-mono break-all">
                {(storageClass.mountOptions ?? EMPTY).join(', ')}
              </span>
            </Show>
          </DetailRow>
        </DetailGrid>
      ),
    },
    {
      id: 'parameters',
      title: 'Parameters',
      render: (storageClass: V1StorageClass) => (
        <div class="flex flex-col gap-1.5">
          <p class="text-2xs text-[var(--text-tertiary)]">
            Passed verbatim to the provisioner. The keys are driver-specific.
          </p>
          <KeyValueTable
            entries={parameterEntries(storageClass)}
            empty="This class sets no parameters"
          />
        </div>
      ),
    },
    {
      id: 'topologies',
      title: 'Allowed topologies',
      render: (storageClass: V1StorageClass) => (
        <Show
          when={topologyTerms(storageClass).length > 0}
          fallback={
            <p class="text-2xs text-[var(--text-tertiary)]">
              None — volumes may be provisioned anywhere the provisioner can reach.
            </p>
          }
        >
          <div class="flex flex-col gap-1.5">
            <For each={topologyTerms(storageClass)}>
              {(requirements, index) => (
                <div class="flex flex-col gap-0.5">
                  {/* Terms are alternatives; requirements within one must all hold. */}
                  <Show when={index() > 0}>
                    <span class="text-2xs text-[var(--text-tertiary)]">or</span>
                  </Show>
                  <For each={requirements}>
                    {(requirement) => (
                      <span class="selectable text-2xs font-mono break-all">{requirement}</span>
                    )}
                  </For>
                </div>
              )}
            </For>
          </div>
        </Show>
      ),
    },
    {
      id: 'metadata',
      title: 'Metadata',
      render: (storageClass: V1StorageClass) => (
        <DetailGrid>
          <DetailRow label="Name">{storageClass.metadata?.name}</DetailRow>
          <DetailRow label="Created">
            <AgeCell timestamp={storageClass.metadata?.creationTimestamp} /> ago
          </DetailRow>
          <DetailRow label="Labels">
            <LabelList entries={storageClass.metadata?.labels} />
          </DetailRow>
          <DetailRow label="Annotations">
            <LabelList entries={storageClass.metadata?.annotations} />
          </DetailRow>
        </DetailGrid>
      ),
    },
  ],
});
