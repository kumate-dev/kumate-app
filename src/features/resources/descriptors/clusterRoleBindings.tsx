/**
 * ClusterRoleBindings. Cluster-scoped.
 *
 * The subjects table and the `Kind/name` role reference come from `roleBindings.tsx`:
 * `RbacV1Subject` and `V1RoleRef` are the same types on both kinds, and the two React
 * files differed only in a namespace column. What is genuinely different about this kind
 * is the blast radius — a ClusterRoleBinding grants across *every* namespace, including
 * ones created after it — so this file adds the two checks that matter and nothing else.
 *
 * ## What the React screen got wrong
 *
 * - **The role reference was printed as a bare name.** `cluster-admin` and a
 *   locally-defined `cluster-admin` read identically; the kind is shown here.
 * - **`Subjects` sorted as a string**, so 10 subjects sorted between 1 and 2.
 * - **Nothing distinguished a binding to `system:unauthenticated`.** Binding any role to
 *   that group, or to `system:anonymous`, grants it to every unauthenticated caller that
 *   can reach the apiserver. It is a real and repeatedly-made misconfiguration, and this
 *   is the only screen where it is visible; it is called out rather than left as one more
 *   row in a list.
 */

import { Show } from 'solid-js';
import { Link2 } from 'lucide-solid';
import type { RbacV1Subject, V1ClusterRoleBinding } from '@kubernetes/client-node';

import {
  deleteClusterRoleBindings,
  listClusterRoleBindings,
  updateClusterRoleBinding,
  watchClusterRoleBindings,
} from '@/api/k8s/clusterRoleBindings';

import { AgeCell, DetailGrid, DetailRow, LabelList, ageValue } from '../detail-parts';
import { defineResource } from '../types';

import { SubjectsTable, roleRefText, subjectCount } from './roleBindings';

/** One shared empty array for the `?? []` defaults on the hot paths. */
const EMPTY = [] as const;

/**
 * Subjects that mean "anyone who can reach the apiserver".
 *
 * `system:unauthenticated` is the group every request without credentials lands in, and
 * `system:anonymous` is the user it is given. Bound to a role, either one publishes that
 * role to the internet if the apiserver is reachable from it.
 */
const PUBLIC_SUBJECTS: ReadonlySet<string> = new Set([
  'system:unauthenticated',
  'system:anonymous',
]);

const hasPublicSubject = (subjects?: readonly RbacV1Subject[]): boolean => {
  for (const subject of subjects ?? EMPTY) {
    if (PUBLIC_SUBJECTS.has(subject.name)) return true;
  }
  return false;
};

/* -------------------------------------------------------------------------- */
/* Descriptor                                                                 */
/* -------------------------------------------------------------------------- */

export const clusterRoleBindingsDescriptor = defineResource({
  id: 'clusterRoleBindings',
  kind: 'ClusterRoleBinding',
  title: 'Cluster Role Bindings',
  group: 'access',
  icon: Link2,
  namespaced: false,

  // Cluster-scoped: `list_cluster_role_bindings` takes `{ name }` and
  // `delete_cluster_role_bindings` `{ name, resourceNames }`.
  api: {
    list: listClusterRoleBindings,
    watch: watchClusterRoleBindings,
    remove: deleteClusterRoleBindings,
    update: updateClusterRoleBinding,
  },

  // "Who is bound to cluster-admin?" is the audit question this kind exists to answer, and
  // both halves of it — the role and the subject names — are searched here.
  searchExtra: (binding: V1ClusterRoleBinding) => {
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
      width: 'minmax(200px, 3fr)',
      value: (binding: V1ClusterRoleBinding) => binding.metadata?.name,
    },
    {
      id: 'roleRef',
      header: 'Role',
      width: 'minmax(160px, 2.2fr)',
      value: (binding: V1ClusterRoleBinding) => roleRefText(binding.roleRef),
      cell: (binding: V1ClusterRoleBinding) => (
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
      value: (binding: V1ClusterRoleBinding) => subjectCount(binding.subjects),
      cell: (binding: V1ClusterRoleBinding) => (
        <span class="tnum">{subjectCount(binding.subjects)}</span>
      ),
    },
    {
      id: 'age',
      header: 'Age',
      width: '68px',
      align: 'right',
      value: (binding: V1ClusterRoleBinding) => ageValue(binding),
      cell: (binding: V1ClusterRoleBinding) => (
        <AgeCell timestamp={binding.metadata?.creationTimestamp} />
      ),
    },
  ],

  detail: [
    {
      id: 'grant',
      title: 'Grants',
      render: (binding: V1ClusterRoleBinding) => (
        <DetailGrid>
          <DetailRow label="Role kind">{binding.roleRef?.kind}</DetailRow>
          <DetailRow label="Role name">{binding.roleRef?.name}</DetailRow>
          <DetailRow label="API group">{binding.roleRef?.apiGroup}</DetailRow>
          <DetailRow label="Scope">
            Every namespace, including ones that do not exist yet, plus cluster-scoped resources.
          </DetailRow>
        </DetailGrid>
      ),
    },
    {
      id: 'subjects',
      title: 'Subjects',
      render: (binding: V1ClusterRoleBinding) => (
        <div class="flex flex-col gap-1.5">
          <Show when={hasPublicSubject(binding.subjects)}>
            <p class="text-2xs text-[var(--status-danger)]">
              This binding includes an unauthenticated subject: the role is granted to every caller
              that can reach the apiserver, credentials or not.
            </p>
          </Show>
          <SubjectsTable
            subjects={binding.subjects}
            empty="No subjects. This binding grants nothing to anyone."
          />
        </div>
      ),
    },
    {
      id: 'metadata',
      title: 'Metadata',
      render: (binding: V1ClusterRoleBinding) => (
        <DetailGrid>
          <DetailRow label="Name">{binding.metadata?.name}</DetailRow>
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
