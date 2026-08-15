/**
 * Namespaces. Cluster-scoped.
 *
 * A namespace is a two-field object, so there is only one question this screen ever has to
 * answer: **why is it still Terminating?** The answer is always a finalizer that nothing
 * has cleared, and the namespace controller writes the specifics into `status.conditions`.
 *
 * ## What the React screen got wrong
 *
 * - **`utils/namespaceStatus.ts` read only `status.phase`.** `metadata.deletionTimestamp`
 *   is set the instant a delete is accepted; `status.phase` only becomes `Terminating`
 *   once the namespace controller has picked the object up. In the gap the screen said
 *   `Active` in green — during the one moment a reader most needs to be told otherwise.
 * - **Only `spec.finalizers` was shown.** That field holds the single legacy `kubernetes`
 *   finalizer. The finalizers that actually wedge a namespace in 2024 live on
 *   `metadata.finalizers` and are put there by operators and CRD controllers. The screen
 *   was looking at the wrong list.
 * - **`status.conditions` was a YAML dump.** `NamespaceFinalizersRemaining` and
 *   `NamespaceDeletionContentFailure` name the exact resource that is blocking, and they
 *   are the only place in the API that does. They are a `ConditionsTable` here, and the
 *   five namespace conditions were added to `NEGATIVE_CONDITIONS` in `detail-parts.tsx`
 *   because for all of them `True` means trouble.
 */

import { For, Show } from 'solid-js';
import { FolderTree } from 'lucide-solid';
import type { V1Namespace } from '@kubernetes/client-node';

import {
  deleteNamespaces,
  listNamespaces,
  updateNamespace,
  watchNamespaces,
} from '@/api/k8s/namespaces';
import type { K8sStatus } from '@/types/k8sStatus';
import { Badge } from '@/ui/Badge';
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

/** One shared empty array for the `?? []` defaults on the hot paths. */
const EMPTY = [] as const;

/* -------------------------------------------------------------------------- */
/* Status                                                                     */
/* -------------------------------------------------------------------------- */

/** True from the moment the delete is accepted, not from when the controller notices. */
const isTerminating = (namespace: V1Namespace): boolean =>
  namespace.status?.phase === 'Terminating' || namespace.metadata?.deletionTimestamp !== undefined;

export const getNamespaceStatus = (namespace: V1Namespace): K8sStatus => {
  if (isTerminating(namespace)) return { status: 'Terminating', variant: 'warning' };

  const phase = namespace.status?.phase;
  if (phase === 'Active') return { status: 'Active', variant: 'success' };

  // The API defines exactly two phases, so anything else came from a server we do not
  // understand. Passing it through beats inventing an `Unknown` that hides it.
  return { status: phase ?? 'Unknown', variant: 'default' };
};

/* -------------------------------------------------------------------------- */
/* Finalizers                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Every finalizer on the object, from both of the places they hide.
 *
 * `spec.finalizers` is the legacy list — in practice the single entry `kubernetes` — and
 * `metadata.finalizers` is where controllers and operators add theirs. A namespace cannot
 * finish deleting while either is non-empty, so showing one without the other answers the
 * question wrongly half the time.
 */
const allFinalizers = (namespace: V1Namespace): string[] => [
  ...(namespace.spec?.finalizers ?? EMPTY),
  ...(namespace.metadata?.finalizers ?? EMPTY),
];

interface FinalizerListProps {
  finalizers: readonly string[];
  empty: string;
}

function FinalizerList(props: FinalizerListProps) {
  return (
    <Show
      when={props.finalizers.length > 0}
      fallback={<span class="text-2xs text-[var(--text-tertiary)]">{props.empty}</span>}
    >
      <div class="flex flex-wrap gap-1">
        <For each={props.finalizers}>
          {(finalizer) => (
            <Badge variant="warn" size="sm">
              <span class="selectable truncate font-mono">{finalizer}</span>
            </Badge>
          )}
        </For>
      </div>
    </Show>
  );
}

/* -------------------------------------------------------------------------- */
/* Descriptor                                                                 */
/* -------------------------------------------------------------------------- */

export const namespacesDescriptor = defineResource({
  id: 'namespaces',
  kind: 'Namespace',
  title: 'Namespaces',
  group: 'cluster',
  icon: FolderTree,
  namespaced: false,

  // Cluster-scoped: `list_namespaces` takes `{ name }` and `delete_namespaces`
  // `{ name, resourceNames }`. `updateNamespace` goes through the generic
  // custom-resource command rather than a dedicated one, which is why it is in
  // `api/k8s/namespaces.ts` and not obvious from the command list — but it works, so the
  // YAML tab is editable. Editing labels and annotations is the whole reason anyone opens
  // a Namespace manifest.
  api: {
    list: listNamespaces,
    watch: watchNamespaces,
    remove: deleteNamespaces,
    update: updateNamespace,
  },

  status: getNamespaceStatus,

  // Namespaces are routinely labelled with the team, environment or tenant that owns them,
  // and on a cluster with three hundred of them that label is how one is found.
  searchExtra: (namespace: V1Namespace) => [
    ...Object.entries(namespace.metadata?.labels ?? {}).map(([key, value]) => `${key}=${value}`),
  ],

  columns: [
    {
      id: 'name',
      header: 'Name',
      width: 'minmax(200px, 3fr)',
      value: (namespace: V1Namespace) => namespace.metadata?.name,
    },
    {
      id: 'status',
      header: 'Status',
      width: 'minmax(110px, 1.2fr)',
      value: (namespace: V1Namespace) => getNamespaceStatus(namespace).status,
      cell: (namespace: V1Namespace) => {
        const status = getNamespaceStatus(namespace);
        return <StatusBadge status={status.status} variant={status.variant} size="sm" />;
      },
    },
    {
      id: 'age',
      header: 'Age',
      width: '68px',
      align: 'right',
      value: (namespace: V1Namespace) => ageValue(namespace),
      cell: (namespace: V1Namespace) => (
        <AgeCell timestamp={namespace.metadata?.creationTimestamp} />
      ),
    },
  ],

  detail: [
    {
      id: 'lifecycle',
      title: 'Status & finalizers',
      // First section, ahead of Metadata: see the file header. Nothing else about a
      // Namespace is ever the reason it was opened.
      render: (namespace: V1Namespace) => (
        <DetailGrid>
          <DetailRow label="Status">{getNamespaceStatus(namespace).status}</DetailRow>
          <DetailRow label="Phase">{namespace.status?.phase}</DetailRow>
          <DetailRow label="Deleting for">
            <Show when={namespace.metadata?.deletionTimestamp}>
              {(timestamp) => <AgeCell timestamp={timestamp()} />}
            </Show>
          </DetailRow>
          <DetailRow label="Finalizers">
            <FinalizerList
              finalizers={allFinalizers(namespace)}
              empty="None — nothing is holding this namespace open."
            />
          </DetailRow>
          <Show when={isTerminating(namespace) && allFinalizers(namespace).length > 0}>
            <DetailRow label="Note" class="text-[var(--status-warn)]">
              A namespace stops at Terminating until every finalizer above is removed by whatever
              put it there. The conditions below name what is still outstanding.
            </DetailRow>
          </Show>
          <Show when={isTerminating(namespace) && allFinalizers(namespace).length === 0}>
            <DetailRow label="Note">
              No finalizers remain; the deletion should complete on the controller's next pass.
            </DetailRow>
          </Show>
          <DetailRow label="Created">
            <AgeCell timestamp={namespace.metadata?.creationTimestamp} /> ago
          </DetailRow>
        </DetailGrid>
      ),
    },
    {
      id: 'conditions',
      title: 'Conditions',
      render: (namespace: V1Namespace) => (
        <ConditionsTable
          conditions={namespace.status?.conditions}
          // A healthy namespace reports nothing here, so the empty state has to say that
          // rather than read as missing data.
          empty="None. The namespace controller only reports conditions while deleting."
        />
      ),
    },
    {
      id: 'metadata',
      title: 'Metadata',
      render: (namespace: V1Namespace) => (
        <DetailGrid>
          <DetailRow label="Name">{namespace.metadata?.name}</DetailRow>
          <DetailRow label="UID">
            <span class="text-2xs font-mono">{namespace.metadata?.uid}</span>
          </DetailRow>
          <DetailRow label="Labels">
            {/* `kubernetes.io/metadata.name` is added by the apiserver on every namespace
                and is how Pod Security admission and namespaceSelectors target one. */}
            <LabelList entries={namespace.metadata?.labels} />
          </DetailRow>
          <DetailRow label="Annotations">
            <LabelList entries={namespace.metadata?.annotations} />
          </DetailRow>
        </DetailGrid>
      ),
    },
  ],
});
