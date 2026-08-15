/**
 * ClusterRoles. Cluster-scoped.
 *
 * The rules table is imported from `roles.tsx` rather than copied. `V1PolicyRule` is the
 * same type on both kinds and the rendering is identical to the character; duplicating it
 * would recreate the `pages/Roles.tsx` / `pages/ClusterRoles.tsx` split that `types.ts`
 * names as the reason the descriptor system exists. Everything a ClusterRole has that a
 * Role does not is in this file.
 *
 * ## What the React screen got wrong
 *
 * - **`aggregationRule` was invisible.** `SidebarClusterRoles` dumped `rules` and nothing
 *   else, so an aggregated role — `view`, `edit`, `admin`, and every operator-defined role
 *   that follows the pattern — looked like an ordinary one. It is not: its `rules` are
 *   *generated*, the aggregation controller overwrites anything typed into them, and the
 *   thing that actually decides its permissions is the label selector shown here.
 * - **`Rules` sorted as a string**, so 10 rules sorted between 1 and 2. Same bug as Roles.
 */

import { For, Show } from 'solid-js';
import { ShieldPlus } from 'lucide-solid';
import type { V1ClusterRole, V1LabelSelector } from '@kubernetes/client-node';

import {
  deleteClusterRoles,
  listClusterRoles,
  updateClusterRole,
  watchClusterRoles,
} from '@/api/k8s/clusterRoles';

import { AgeCell, DetailGrid, DetailRow, LabelList, ageValue } from '../detail-parts';
import { defineResource } from '../types';

import { RulesTable, ruleCount } from './roles';

/** One shared empty array for the `?? []` defaults on the hot paths. */
const EMPTY = [] as const;

/* -------------------------------------------------------------------------- */
/* Aggregation                                                                */
/* -------------------------------------------------------------------------- */

const isAggregated = (role: V1ClusterRole): boolean =>
  (role.aggregationRule?.clusterRoleSelectors ?? EMPTY).length > 0;

/** `key in (a,b)` — the notation `kubectl describe` uses for a selector expression. */
const expressionText = (expression: {
  key: string;
  operator: string;
  values?: string[];
}): string => {
  // `Exists` and `DoesNotExist` take no values; printing `key in ()` for them would read
  // as "matches nothing", which is the opposite of `Exists`.
  if (expression.operator === 'Exists') return expression.key;
  if (expression.operator === 'DoesNotExist') return `!${expression.key}`;
  const values = (expression.values ?? EMPTY).join(',');
  return `${expression.key} ${expression.operator.toLowerCase()} (${values})`;
};

/**
 * One aggregation selector as text.
 *
 * An *empty* selector here would aggregate every ClusterRole in the cluster into this one.
 * The apiserver does not forbid it and it is a spectacular way to grant cluster-admin by
 * accident, so it is named rather than rendered as a blank line.
 */
const selectorText = (selector: V1LabelSelector): string => {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(selector.matchLabels ?? {})) {
    parts.push(`${key}=${value}`);
  }
  for (const expression of selector.matchExpressions ?? EMPTY) {
    parts.push(expressionText(expression));
  }
  return parts.length === 0 ? 'every ClusterRole in the cluster' : parts.join(', ');
};

/* -------------------------------------------------------------------------- */
/* Descriptor                                                                 */
/* -------------------------------------------------------------------------- */

export const clusterRolesDescriptor = defineResource({
  id: 'clusterRoles',
  kind: 'ClusterRole',
  title: 'Cluster Roles',
  group: 'access',
  icon: ShieldPlus,
  namespaced: false,

  // Cluster-scoped: `list_cluster_roles` takes `{ name }` and `delete_cluster_roles`
  // `{ name, resourceNames }`.
  api: {
    list: listClusterRoles,
    watch: watchClusterRoles,
    remove: deleteClusterRoles,
    update: updateClusterRole,
  },

  // A default cluster carries ~70 `system:` ClusterRoles, so searching by the resource a
  // role grants is the only practical way to find the one that matters.
  searchExtra: (role: V1ClusterRole) => {
    const terms: string[] = [];
    for (const rule of role.rules ?? EMPTY) {
      for (const resource of rule.resources ?? EMPTY) terms.push(resource);
      for (const verb of rule.verbs ?? EMPTY) terms.push(verb);
    }
    for (const [key, value] of Object.entries(role.metadata?.labels ?? {})) {
      terms.push(`${key}=${value}`);
    }
    return terms;
  },

  columns: [
    {
      id: 'name',
      header: 'Name',
      width: 'minmax(200px, 4fr)',
      value: (role: V1ClusterRole) => role.metadata?.name,
    },
    {
      id: 'rules',
      header: 'Rules',
      width: '64px',
      align: 'right',
      value: (role: V1ClusterRole) => ruleCount(role.rules),
      cell: (role: V1ClusterRole) => <span class="tnum">{ruleCount(role.rules)}</span>,
    },
    {
      id: 'age',
      header: 'Age',
      width: '68px',
      align: 'right',
      value: (role: V1ClusterRole) => ageValue(role),
      cell: (role: V1ClusterRole) => <AgeCell timestamp={role.metadata?.creationTimestamp} />,
    },
  ],

  detail: [
    {
      id: 'aggregation',
      title: 'Aggregation',
      // `null` omits the section entirely — most ClusterRoles are not aggregated, and a
      // permanent "None" row above the rules would push them down for nothing.
      render: (role: V1ClusterRole) =>
        !isAggregated(role) ? null : (
          <div class="flex flex-col gap-1.5">
            <p class="text-2xs text-[var(--status-warn)]">
              The rules below are generated by the aggregation controller from every ClusterRole
              matching the selectors. Editing them directly is overwritten.
            </p>
            <div class="flex flex-col gap-0.5">
              <For each={role.aggregationRule?.clusterRoleSelectors}>
                {(selector) => (
                  <span class="selectable text-2xs font-mono break-all text-[var(--text-primary)]">
                    {selectorText(selector)}
                  </span>
                )}
              </For>
            </div>
          </div>
        ),
    },
    {
      id: 'rules',
      title: 'Rules',
      render: (role: V1ClusterRole) => <RulesTable rules={role.rules} />,
    },
    {
      id: 'metadata',
      title: 'Metadata',
      render: (role: V1ClusterRole) => (
        <DetailGrid>
          <DetailRow label="Name">{role.metadata?.name}</DetailRow>
          <DetailRow label="Created">
            <AgeCell timestamp={role.metadata?.creationTimestamp} /> ago
          </DetailRow>
          <DetailRow label="Rules">{ruleCount(role.rules)}</DetailRow>
          <DetailRow label="Aggregated">
            <Show when={isAggregated(role)} fallback="No">
              Yes — {(role.aggregationRule?.clusterRoleSelectors ?? EMPTY).length} selector(s)
            </Show>
          </DetailRow>
          <DetailRow label="Labels">
            {/* `rbac.authorization.k8s.io/aggregate-to-*` labels here are how this role
                feeds *other* aggregated roles — the relationship runs both ways. */}
            <LabelList entries={role.metadata?.labels} />
          </DetailRow>
          <DetailRow label="Annotations">
            <LabelList entries={role.metadata?.annotations} />
          </DetailRow>
        </DetailGrid>
      ),
    },
  ],
});
