/**
 * Roles.
 *
 * A Role *is* its rules. `SidebarRoles` printed the count and then dumped `rules` as YAML,
 * which meant the one question this kind answers — "what can the holder of this role
 * actually do?" — was answered by reading unindented YAML in a 300px-wide panel.
 *
 * `RulesTable` below renders the rules as the table they are: one row per rule, one column
 * per axis. It is exported and reused verbatim by `clusterRoles.tsx`, because
 * `V1PolicyRule` is the same type on both kinds and `types.ts` names
 * `diff pages/Roles.tsx pages/ClusterRoles.tsx` as the exact duplication this rewrite
 * exists to kill.
 *
 * Three details the YAML dump could not convey and the table does:
 *
 * - **The core API group is the empty string.** `apiGroups: ['']` rendered as a blank cell.
 *   It is spelled `core` here, because a blank cell reads as "no restriction" — the
 *   opposite of what it means.
 * - **An empty `resourceNames` means *every* object of that resource**, not none. Spelled
 *   out for the same reason.
 * - **`*` is a wildcard**, and a rule with `verbs: ['*']` on `resources: ['*']` is
 *   cluster-admin in miniature. Every `*` is drawn in the warning hue so it cannot be
 *   skimmed past.
 *
 * Checked for the renamed-wire-field trap that `V1NetworkPolicyIngressRule._from` and
 * `V1LimitRangeItem._default` set: `V1PolicyRule`, `V1RoleRef` and `RbacV1Subject` contain
 * no reserved words, so every property here is the wire name and reads correctly from the
 * raw JSON the Tauri commands return.
 */

import { For, Show } from 'solid-js';
import { Shield } from 'lucide-solid';
import type { V1PolicyRule, V1Role } from '@kubernetes/client-node';

import { deleteRoles, listRoles, updateRole, watchRoles } from '@/api/k8s/roles';

import { AgeCell, DetailGrid, DetailRow, LabelList, ageValue } from '../detail-parts';
import { defineResource } from '../types';

/** One shared empty array for the `?? []` defaults on the hot paths. */
const EMPTY = [] as const;

export const ruleCount = (rules?: readonly V1PolicyRule[]): number => rules?.length ?? 0;

/* -------------------------------------------------------------------------- */
/* Terms                                                                      */
/* -------------------------------------------------------------------------- */

interface TermsProps {
  terms?: readonly string[];
  /** What an *empty* list means for this column — it is never "nothing". */
  empty: string;
  /** Substituted for the empty-string term. The core API group is `''`. */
  blank?: string;
}

/**
 * One cell of the rules table: a wrapped list of terms, wildcards highlighted.
 *
 * Wrapped rather than truncated because every term in a policy rule is load-bearing —
 * hiding the fourth verb behind an ellipsis hides exactly the `delete` someone is looking
 * for. Rules are counted in tens, not thousands, so the extra height is affordable here in
 * a way it would not be in a table cell.
 */
function Terms(props: TermsProps) {
  return (
    <Show
      when={(props.terms ?? EMPTY).length > 0}
      fallback={<span class="text-[var(--text-tertiary)]">{props.empty}</span>}
    >
      <span class="flex flex-wrap gap-x-1.5 gap-y-0.5">
        <For each={props.terms}>
          {(term) => (
            <span
              class={
                term === '*'
                  ? 'font-mono text-[var(--status-warn)]'
                  : 'font-mono text-[var(--text-primary)]'
              }
            >
              {term === '' ? (props.blank ?? "''") : term}
            </span>
          )}
        </For>
      </span>
    </Show>
  );
}

/* -------------------------------------------------------------------------- */
/* Rules table                                                                */
/* -------------------------------------------------------------------------- */

const RULE_GRID =
  'grid grid-cols-[minmax(60px,1fr)_minmax(80px,1.5fr)_minmax(70px,1fr)_minmax(90px,1.6fr)] items-start gap-2';

export interface RulesTableProps {
  rules?: readonly V1PolicyRule[];
}

/**
 * `rules` as a real table — API groups, resources, resource names, verbs.
 *
 * `nonResourceURLs` shares the resources column rather than getting one of its own: the
 * two are mutually exclusive within a rule (a non-resource rule such as `/healthz` or
 * `/metrics` names no resources at all), and a column that is empty on 99% of rows would
 * cost every other column the width it needs.
 */
export function RulesTable(props: RulesTableProps) {
  return (
    <Show
      when={(props.rules ?? EMPTY).length > 0}
      fallback={
        <p class="text-2xs text-[var(--text-tertiary)]">
          No rules. This role grants nothing — which is legal, and is what an aggregated role looks
          like before its controller has filled it in.
        </p>
      }
    >
      <div class="flex flex-col divide-y divide-[var(--border-subtle)]">
        <div class={`text-2xs ${RULE_GRID} pb-1 text-[var(--text-tertiary)]`}>
          <span>API groups</span>
          <span>Resources</span>
          <span>Resource names</span>
          <span>Verbs</span>
        </div>

        <For each={props.rules}>
          {(rule) => (
            <div class={`text-2xs selectable ${RULE_GRID} py-1.5`}>
              <Terms terms={rule.apiGroups} empty="core" blank="core" />

              <Show
                when={(rule.resources ?? EMPTY).length > 0}
                fallback={<Terms terms={rule.nonResourceURLs} empty="—" />}
              >
                <Terms terms={rule.resources} empty="—" />
              </Show>

              <Terms terms={rule.resourceNames} empty="all" />
              <Terms terms={rule.verbs} empty="none" />
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

export const rolesDescriptor = defineResource({
  id: 'roles',
  kind: 'Role',
  title: 'Roles',
  group: 'access',
  icon: Shield,
  namespaced: true,

  api: {
    list: listRoles,
    watch: watchRoles,
    remove: deleteRoles,
    update: updateRole,
  },

  // Searching a role list by *resource* is the useful query — "what grants access to
  // secrets in this namespace?" — and it is not visible in any column.
  searchExtra: (role: V1Role) => {
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
      width: 'minmax(180px, 2.8fr)',
      value: (role: V1Role) => role.metadata?.name,
    },
    {
      id: 'namespace',
      header: 'Namespace',
      width: 'minmax(110px, 1.2fr)',
      value: (role: V1Role) => role.metadata?.namespace,
    },
    {
      id: 'rules',
      header: 'Rules',
      width: '64px',
      align: 'right',
      // The number, not `String(n)`: the React pane sorted the stringified count, so a
      // role with 10 rules sorted between 1 and 2.
      value: (role: V1Role) => ruleCount(role.rules),
      cell: (role: V1Role) => <span class="tnum">{ruleCount(role.rules)}</span>,
    },
    {
      id: 'age',
      header: 'Age',
      width: '68px',
      align: 'right',
      value: (role: V1Role) => ageValue(role),
      cell: (role: V1Role) => <AgeCell timestamp={role.metadata?.creationTimestamp} />,
    },
  ],

  detail: [
    {
      id: 'rules',
      title: 'Rules',
      // First section: it is the entire content of the kind.
      render: (role: V1Role) => <RulesTable rules={role.rules} />,
    },
    {
      id: 'metadata',
      title: 'Metadata',
      render: (role: V1Role) => (
        <DetailGrid>
          <DetailRow label="Name">{role.metadata?.name}</DetailRow>
          <DetailRow label="Namespace">{role.metadata?.namespace}</DetailRow>
          <DetailRow label="Created">
            <AgeCell timestamp={role.metadata?.creationTimestamp} /> ago
          </DetailRow>
          <DetailRow label="Rules">{ruleCount(role.rules)}</DetailRow>
          <DetailRow label="Labels">
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
