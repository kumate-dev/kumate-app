/**
 * RoleBindings.
 *
 * A binding is two things: what it grants (`roleRef`) and who it grants it to
 * (`subjects`). `PaneRoleBindings` printed `roleRef.name` alone and `SidebarRoleBindings`
 * dumped both as YAML, which loses the half of `roleRef` that decides the blast radius:
 * **a RoleBinding may reference a ClusterRole**, and when it does, the ClusterRole's rules
 * apply within this namespace. `Role/edit` and `ClusterRole/edit` are entirely different
 * grants and the React screen rendered both as `edit`.
 *
 * `SubjectsTable` and `roleRefText` are exported and reused by `clusterRoleBindings.tsx`;
 * `RbacV1Subject` and `V1RoleRef` are the same types on both kinds, and the two React
 * files differed only in the namespace column.
 *
 * Checked for the renamed-wire-field trap (`V1NetworkPolicyIngressRule._from`,
 * `V1LimitRangeItem._default`): neither `V1RoleRef` nor `RbacV1Subject` contains a
 * reserved word, so every property below is the wire name.
 */

import { For, Show } from 'solid-js';
import { Link } from 'lucide-solid';
import type { RbacV1Subject, V1RoleBinding, V1RoleRef } from '@kubernetes/client-node';

import {
  deleteRoleBindings,
  listRoleBindings,
  updateRoleBinding,
  watchRoleBindings,
} from '@/api/k8s/roleBindings';

import { AgeCell, DetailGrid, DetailRow, LabelList, ageValue } from '../detail-parts';
import { defineResource } from '../types';

/** One shared empty array for the `?? []` defaults on the hot paths. */
const EMPTY = [] as const;

export const subjectCount = (subjects?: readonly RbacV1Subject[]): number => subjects?.length ?? 0;

/**
 * `Kind/name` — the ROLE column of `kubectl get rolebindings`.
 *
 * The kind is not decoration: see the file header. `roleRef` is required by the schema but
 * the object can still arrive without it from a malformed `kubectl apply --force`, so it
 * is treated as optional here rather than trusted.
 */
export const roleRefText = (ref?: V1RoleRef): string | undefined => {
  if (!ref?.name) return undefined;
  return ref.kind ? `${ref.kind}/${ref.name}` : ref.name;
};

/* -------------------------------------------------------------------------- */
/* Subjects                                                                   */
/* -------------------------------------------------------------------------- */

const SUBJECT_GRID = 'grid grid-cols-[92px_minmax(0,1fr)_minmax(0,1fr)] items-baseline gap-2';

export interface SubjectsTableProps {
  subjects?: readonly RbacV1Subject[];
  /** Shown when there are none — the consequence differs between the two binding kinds. */
  empty: string;
}

/**
 * Who this binding grants to: kind, name, namespace.
 *
 * The namespace column exists only for `ServiceAccount` subjects — `User` and `Group` are
 * cluster-wide identities and have none — so it is rendered as an em dash rather than left
 * blank, per the `detail-parts` rule that nothing is ever empty.
 */
export function SubjectsTable(props: SubjectsTableProps) {
  return (
    <Show
      when={(props.subjects ?? EMPTY).length > 0}
      fallback={<p class="text-2xs text-[var(--text-tertiary)]">{props.empty}</p>}
    >
      <div class="flex flex-col divide-y divide-[var(--border-subtle)]">
        <div class={`text-2xs ${SUBJECT_GRID} pb-1 text-[var(--text-tertiary)]`}>
          <span>Kind</span>
          <span>Name</span>
          <span>Namespace</span>
        </div>

        <For each={props.subjects}>
          {(subject) => (
            <div class={`text-2xs selectable ${SUBJECT_GRID} py-1`}>
              <span class="truncate text-[var(--text-secondary)]">{subject.kind}</span>
              <span class="font-mono break-all text-[var(--text-primary)]" title={subject.name}>
                {subject.name}
              </span>
              <Show
                when={subject.namespace}
                fallback={<span class="text-[var(--text-tertiary)]">—</span>}
              >
                <span class="truncate font-mono text-[var(--text-secondary)]">
                  {subject.namespace}
                </span>
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

export const roleBindingsDescriptor = defineResource({
  id: 'roleBindings',
  kind: 'RoleBinding',
  title: 'Role Bindings',
  group: 'access',
  icon: Link,
  namespaced: true,

  api: {
    list: listRoleBindings,
    watch: watchRoleBindings,
    remove: deleteRoleBindings,
    update: updateRoleBinding,
  },

  // Subject names are the question people arrive with — "what does this service account
  // have in this namespace?" — and they appear in no column.
  searchExtra: (binding: V1RoleBinding) => {
    const terms: (string | undefined)[] = [roleRefText(binding.roleRef)];
    for (const subject of binding.subjects ?? EMPTY) terms.push(subject.name);
    for (const [key, value] of Object.entries(binding.metadata?.labels ?? {})) {
      terms.push(`${key}=${value}`);
    }
    return terms;
  },

  columns: [
    {
      id: 'name',
      header: 'Name',
      width: 'minmax(180px, 2.6fr)',
      value: (binding: V1RoleBinding) => binding.metadata?.name,
    },
    {
      id: 'namespace',
      header: 'Namespace',
      width: 'minmax(110px, 1.2fr)',
      value: (binding: V1RoleBinding) => binding.metadata?.namespace,
    },
    {
      id: 'roleRef',
      header: 'Role',
      width: 'minmax(150px, 2fr)',
      value: (binding: V1RoleBinding) => roleRefText(binding.roleRef),
      cell: (binding: V1RoleBinding) => (
        <span class="truncate" title={roleRefText(binding.roleRef)}>
          {roleRefText(binding.roleRef)}
        </span>
      ),
    },
    {
      id: 'subjects',
      header: 'Subjects',
      width: '76px',
      align: 'right',
      // The number, not `String(n)`: the React pane sorted the stringified count.
      value: (binding: V1RoleBinding) => subjectCount(binding.subjects),
      cell: (binding: V1RoleBinding) => <span class="tnum">{subjectCount(binding.subjects)}</span>,
    },
    {
      id: 'age',
      header: 'Age',
      width: '68px',
      align: 'right',
      value: (binding: V1RoleBinding) => ageValue(binding),
      cell: (binding: V1RoleBinding) => <AgeCell timestamp={binding.metadata?.creationTimestamp} />,
    },
  ],

  detail: [
    {
      id: 'grant',
      title: 'Grants',
      render: (binding: V1RoleBinding) => (
        <DetailGrid>
          <DetailRow label="Role kind">{binding.roleRef?.kind}</DetailRow>
          <DetailRow label="Role name">{binding.roleRef?.name}</DetailRow>
          <DetailRow label="API group">{binding.roleRef?.apiGroup}</DetailRow>
          <Show when={binding.roleRef?.kind === 'ClusterRole'}>
            <DetailRow label="Note">
              {/* The single most misread thing about this kind. */}A ClusterRole referenced from a
              RoleBinding applies only inside {binding.metadata?.namespace ?? 'this namespace'}.
            </DetailRow>
          </Show>
        </DetailGrid>
      ),
    },
    {
      id: 'subjects',
      title: 'Subjects',
      render: (binding: V1RoleBinding) => (
        <SubjectsTable
          subjects={binding.subjects}
          empty="No subjects. This binding grants nothing to anyone."
        />
      ),
    },
    {
      id: 'metadata',
      title: 'Metadata',
      render: (binding: V1RoleBinding) => (
        <DetailGrid>
          <DetailRow label="Name">{binding.metadata?.name}</DetailRow>
          <DetailRow label="Namespace">{binding.metadata?.namespace}</DetailRow>
          <DetailRow label="Created">
            <AgeCell timestamp={binding.metadata?.creationTimestamp} /> ago
          </DetailRow>
          <DetailRow label="Labels">
            <LabelList entries={binding.metadata?.labels} />
          </DetailRow>
          <DetailRow label="Annotations">
            <LabelList entries={binding.metadata?.annotations} />
          </DetailRow>
        </DetailGrid>
      ),
    },
  ],
});
