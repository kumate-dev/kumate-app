/**
 * NetworkPolicies.
 *
 * ## The bugs this file exists to fix
 *
 * - **`spec.ingress[].from` was unreadable, because the type calls it `_from`.**
 *   `from` is a reserved word, so the generated client renames the property and its
 *   `ObjectSerializer` maps the wire name onto `_from` when *it* deserialises a response.
 *   Nothing in this app runs that serialiser — payloads arrive as raw JSON from a Tauri
 *   command — so at runtime the property really is `from` and `rule._from` is always
 *   `undefined`. Exactly the trap `V1LimitRangeItem._default` set in `limitRanges.tsx`.
 *   `ingressPeers` below reads the wire name and falls back to the renamed one.
 *
 *   `src/templates/networkPolicy.ts` had the same bug pointing the other way: it *emitted*
 *   `_from`, a field the apiserver does not know, so the template's example ingress rule
 *   became `from: []` — which allows traffic from **everywhere** instead of only from
 *   `app=frontend`. Fixed there.
 *
 * - **An empty `podSelector: {}` was rendered as `—`.** An empty selector selects *every
 *   pod in the namespace*; it is how a namespace-wide default-deny is written. Both
 *   `kubectl get netpol` (`<none>`) and `PaneNetworkPolicies` (`—`) print something that
 *   reads as "this applies to nothing", i.e. the precise opposite. This screen spells it
 *   out.
 *
 * - **Only `matchLabels` was read.** A policy that selected pods with `matchExpressions`
 *   rendered as an empty selector, so it was indistinguishable from a select-everything
 *   policy — the one confusion with the largest blast radius on this kind.
 *
 * The rule tables also state the two empty-list semantics that nothing in the object
 * makes visible: an absent rule list denies all traffic in that direction, while a rule
 * with an empty peer list allows it from anywhere.
 */

import { For, Show } from 'solid-js';
import { ShieldCheck } from 'lucide-solid';
import type {
  V1LabelSelector,
  V1NetworkPolicy,
  V1NetworkPolicyIngressRule,
  V1NetworkPolicyPeer,
  V1NetworkPolicyPort,
} from '@kubernetes/client-node';

import {
  deleteNetworkPolicies,
  listNetworkPolicies,
  updateNetworkPolicy,
  watchNetworkPolicies,
} from '@/api/k8s/networkPolicies';
import { Badge } from '@/ui/Badge';

import { AgeCell, DetailGrid, DetailRow, LabelList, ageValue } from '../detail-parts';
import { defineResource } from '../types';

/** One shared empty array for the `?? []` defaults on the column accessors. */
const EMPTY = [] as const;

/** What an empty `podSelector` actually means. See the file header. */
const ALL_PODS = 'All pods in namespace';

/* -------------------------------------------------------------------------- */
/* The `_from` rename                                                         */
/* -------------------------------------------------------------------------- */

const isPeerArray = (value: unknown): value is V1NetworkPolicyPeer[] => Array.isArray(value);

/**
 * The `from` peers of an ingress rule, read under the name the apiserver actually sends.
 *
 * The cast is to a type that *only* adds the wire name, so nothing else about
 * `V1NetworkPolicyIngressRule` is weakened, and the value is narrowed before use rather
 * than asserted. Same shape as `defaultLimits` in `limitRanges.tsx`.
 */
const ingressPeers = (rule: V1NetworkPolicyIngressRule): V1NetworkPolicyPeer[] | undefined => {
  const wire: unknown = (rule as { from?: unknown }).from;
  if (isPeerArray(wire)) return wire;
  return rule._from;
};

/* -------------------------------------------------------------------------- */
/* Selectors                                                                  */
/* -------------------------------------------------------------------------- */

/** `tier in (web,api)` — the notation `kubectl describe` uses for a selector expression. */
const expressionText = (expression: {
  key: string;
  operator: string;
  values?: string[];
}): string => {
  const operator = expression.operator;
  // `Exists` and `DoesNotExist` take no values, and printing `key in ()` for them would
  // read as "matches nothing".
  if (operator === 'Exists') return expression.key;
  if (operator === 'DoesNotExist') return `!${expression.key}`;
  return `${expression.key} ${operator.toLowerCase()} (${(expression.values ?? EMPTY).join(',')})`;
};

/**
 * A label selector as text, with the empty selector spelled out.
 *
 * `undefined` and `{}` are different in this API and the difference matters: inside a
 * peer, an absent `podSelector` means "do not filter by pod", while `{}` means "every pod".
 * Callers pass the empty label for the case they are in.
 */
const selectorText = (selector: V1LabelSelector | undefined, empty: string): string => {
  if (selector === undefined) return empty;

  const parts: string[] = [];
  for (const [key, value] of Object.entries(selector.matchLabels ?? {})) {
    parts.push(`${key}=${value}`);
  }
  for (const expression of selector.matchExpressions ?? EMPTY)
    parts.push(expressionText(expression));

  return parts.length === 0 ? empty : parts.join(', ');
};

/**
 * Non-allocating-ish sort key for the Pod selector column.
 *
 * The first selector term rather than the whole formatted selector: `selectorText`
 * builds an array and joins it, and this runs per row per sort. One template string per
 * row is the floor here — the alternative orderings (term count, nothing) are not
 * something a reader could infer from the cell.
 */
const firstSelectorTerm = (policy: V1NetworkPolicy): string => {
  const selector = policy.spec?.podSelector;
  const labels = selector?.matchLabels;
  if (labels) {
    for (const key in labels) return `${key}=${labels[key]}`;
  }
  const expression = selector?.matchExpressions?.[0];
  if (expression) return expression.key;
  return ALL_PODS;
};

/* -------------------------------------------------------------------------- */
/* Policy types                                                              */
/* -------------------------------------------------------------------------- */

/**
 * The directions this policy governs.
 *
 * `policyTypes` is optional, and the value Kubernetes defaults it to is not "both": it
 * is `[Ingress]`, plus `Egress` only when egress rules are present. A policy whose
 * `policyTypes` is absent therefore does **not** restrict egress no matter what, and
 * showing an empty cell there invites the opposite conclusion.
 */
const policyTypes = (policy: V1NetworkPolicy): readonly string[] => {
  const declared = policy.spec?.policyTypes;
  if (declared && declared.length > 0) return declared;
  return (policy.spec?.egress?.length ?? 0) > 0 ? ['Ingress', 'Egress'] : ['Ingress'];
};

const governs = (policy: V1NetworkPolicy, direction: string): boolean =>
  policyTypes(policy).includes(direction);

/* -------------------------------------------------------------------------- */
/* Peers and ports                                                            */
/* -------------------------------------------------------------------------- */

/**
 * One peer as text.
 *
 * A peer is either an `ipBlock` or a pod/namespace selector pair, and the pair is where
 * the subtlety is: `podSelector` alone means "these pods in *this* namespace", while
 * adding a `namespaceSelector` means "these pods in those namespaces". Getting that
 * backwards is the classic NetworkPolicy mistake, so both halves are always named.
 */
const peerText = (peer: V1NetworkPolicyPeer): string => {
  const block = peer.ipBlock;
  if (block) {
    const except = (block.except ?? EMPTY).join(', ');
    return except ? `${block.cidr} except ${except}` : block.cidr;
  }

  const parts: string[] = [];
  if (peer.namespaceSelector !== undefined) {
    parts.push(`namespaces: ${selectorText(peer.namespaceSelector, 'all')}`);
  } else {
    parts.push('namespaces: this one');
  }
  parts.push(`pods: ${selectorText(peer.podSelector, 'all')}`);
  return parts.join(' · ');
};

/** `TCP 8080`, or `TCP 8000-9000` for a range. */
const portText = (port: V1NetworkPolicyPort): string => {
  const protocol = port.protocol ?? 'TCP';
  if (port.port === undefined) return `${protocol} all ports`;
  // `endPort` extends `port` into a range; without it the rule is a single port.
  return port.endPort === undefined
    ? `${protocol} ${port.port}`
    : `${protocol} ${port.port}-${port.endPort}`;
};

/* -------------------------------------------------------------------------- */
/* Rule tables                                                                */
/* -------------------------------------------------------------------------- */

interface RuleListProps {
  /** `From` for ingress, `To` for egress. */
  peerLabel: string;
  /** One entry per rule: its peers and its ports. */
  rules: { peers?: V1NetworkPolicyPeer[]; ports?: V1NetworkPolicyPort[] }[];
  /** Whether `policyTypes` actually includes this direction. */
  governed: boolean;
}

/**
 * The ingress or egress rules of a policy.
 *
 * The three states below are all invisible in the object itself and all mean something
 * different, which is why each gets its own sentence rather than an empty table:
 *
 * - the direction is not in `policyTypes` → this policy says nothing about it,
 * - it is, and there are no rules → everything in that direction is denied,
 * - there is a rule with no peers → it is allowed from anywhere.
 */
function RuleList(props: RuleListProps) {
  return (
    <Show
      when={props.governed}
      fallback={
        <p class="text-2xs text-[var(--text-tertiary)]">
          Not listed in policyTypes — this policy does not restrict traffic in this direction.
        </p>
      }
    >
      <Show
        when={props.rules.length > 0}
        fallback={
          <p class="text-2xs text-[var(--status-warn)]">
            No rules, and the direction is in policyTypes: all traffic is denied.
          </p>
        }
      >
        <div class="flex flex-col gap-2">
          <For each={props.rules}>
            {(rule) => (
              <div class="rounded-sm border border-[var(--border-subtle)] bg-[var(--surface-inset)] p-2">
                <DetailGrid>
                  <DetailRow label={props.peerLabel}>
                    <Show
                      when={(rule.peers ?? EMPTY).length > 0}
                      fallback={
                        <span class="text-[var(--status-warn)]">
                          Anywhere — an empty peer list allows all sources
                        </span>
                      }
                    >
                      <div class="flex flex-col gap-0.5">
                        <For each={rule.peers}>
                          {(peer) => (
                            <span class="text-2xs font-mono break-all">{peerText(peer)}</span>
                          )}
                        </For>
                      </div>
                    </Show>
                  </DetailRow>
                  <DetailRow label="Ports">
                    <Show when={(rule.ports ?? EMPTY).length > 0} fallback="All ports">
                      <div class="flex flex-wrap gap-1">
                        <For each={rule.ports}>
                          {(port) => (
                            <Badge variant="neutral" size="sm">
                              {portText(port)}
                            </Badge>
                          )}
                        </For>
                      </div>
                    </Show>
                  </DetailRow>
                </DetailGrid>
              </div>
            )}
          </For>
        </div>
      </Show>
    </Show>
  );
}

/* -------------------------------------------------------------------------- */
/* Descriptor                                                                 */
/* -------------------------------------------------------------------------- */

export const networkPoliciesDescriptor = defineResource({
  id: 'networkPolicies',
  kind: 'NetworkPolicy',
  title: 'Network Policies',
  group: 'network',
  icon: ShieldCheck,
  namespaced: true,

  api: {
    list: listNetworkPolicies,
    watch: watchNetworkPolicies,
    remove: deleteNetworkPolicies,
    update: updateNetworkPolicy,
  },

  // Selector labels are the searchable part: the question is always "what is blocking
  // `app=api`?", and the answer is a policy that names it on either side.
  searchExtra: (policy: V1NetworkPolicy) => [
    ...policyTypes(policy),
    ...Object.entries(policy.spec?.podSelector?.matchLabels ?? {}).map(
      ([key, value]) => `${key}=${value}`
    ),
    ...Object.entries(policy.metadata?.labels ?? {}).map(([key, value]) => `${key}=${value}`),
  ],

  columns: [
    {
      id: 'name',
      header: 'Name',
      width: 'minmax(180px, 2.2fr)',
      value: (policy: V1NetworkPolicy) => policy.metadata?.name,
    },
    {
      id: 'namespace',
      header: 'Namespace',
      width: 'minmax(110px, 1.2fr)',
      value: (policy: V1NetworkPolicy) => policy.metadata?.namespace,
    },
    {
      id: 'podSelector',
      header: 'Pod selector',
      width: 'minmax(160px, 2.4fr)',
      value: (policy: V1NetworkPolicy) => firstSelectorTerm(policy),
      cell: (policy: V1NetworkPolicy) => {
        const text = selectorText(policy.spec?.podSelector, ALL_PODS);
        return (
          <span
            class={
              text === ALL_PODS
                ? 'truncate text-[var(--status-warn)]'
                : 'truncate font-mono text-[var(--text-primary)]'
            }
            title={text}
          >
            {text}
          </span>
        );
      },
    },
    {
      id: 'policyTypes',
      header: 'Policy types',
      width: 'minmax(110px, 1.3fr)',
      // Two entries at most, so the join is a single small string per row.
      value: (policy: V1NetworkPolicy) => policyTypes(policy).join(', '),
    },
    {
      id: 'age',
      header: 'Age',
      width: '68px',
      align: 'right',
      value: (policy: V1NetworkPolicy) => ageValue(policy),
      cell: (policy: V1NetworkPolicy) => <AgeCell timestamp={policy.metadata?.creationTimestamp} />,
    },
  ],

  detail: [
    {
      id: 'target',
      title: 'Applies to',
      render: (policy: V1NetworkPolicy) => (
        <DetailGrid>
          <DetailRow label="Pods">
            <Show
              when={selectorText(policy.spec?.podSelector, ALL_PODS) !== ALL_PODS}
              fallback={
                <span class="text-[var(--status-warn)]">
                  Every pod in {policy.metadata?.namespace ?? 'the namespace'} — the pod selector is
                  empty
                </span>
              }
            >
              <LabelList entries={policy.spec?.podSelector?.matchLabels} empty="—" />
            </Show>
          </DetailRow>
          <DetailRow label="Expressions">
            <Show when={(policy.spec?.podSelector?.matchExpressions ?? EMPTY).length > 0}>
              <div class="flex flex-col gap-0.5">
                <For each={policy.spec?.podSelector?.matchExpressions}>
                  {(expression) => (
                    <span class="text-2xs font-mono">{expressionText(expression)}</span>
                  )}
                </For>
              </div>
            </Show>
          </DetailRow>
          <DetailRow label="Policy types">
            <div class="flex flex-wrap gap-1">
              <For each={policyTypes(policy)}>
                {(type) => (
                  <Badge variant={policy.spec?.policyTypes ? 'neutral' : 'warn'} size="sm">
                    {type}
                  </Badge>
                )}
              </For>
            </div>
          </DetailRow>
          <Show when={!policy.spec?.policyTypes}>
            <DetailRow label="Note">
              <span class="text-[var(--text-tertiary)]">
                policyTypes is not set; the values above are the ones Kubernetes infers.
              </span>
            </DetailRow>
          </Show>
        </DetailGrid>
      ),
    },
    {
      id: 'ingress',
      title: 'Ingress rules',
      render: (policy: V1NetworkPolicy) => (
        <RuleList
          peerLabel="From"
          governed={governs(policy, 'Ingress')}
          rules={(policy.spec?.ingress ?? EMPTY).map((rule) => ({
            peers: ingressPeers(rule),
            ports: rule.ports,
          }))}
        />
      ),
    },
    {
      id: 'egress',
      title: 'Egress rules',
      render: (policy: V1NetworkPolicy) => (
        <RuleList
          peerLabel="To"
          governed={governs(policy, 'Egress')}
          rules={(policy.spec?.egress ?? EMPTY).map((rule) => ({
            peers: rule.to,
            ports: rule.ports,
          }))}
        />
      ),
    },
    {
      id: 'metadata',
      title: 'Metadata',
      render: (policy: V1NetworkPolicy) => (
        <DetailGrid>
          <DetailRow label="Name">{policy.metadata?.name}</DetailRow>
          <DetailRow label="Namespace">{policy.metadata?.namespace}</DetailRow>
          <DetailRow label="Created">
            <AgeCell timestamp={policy.metadata?.creationTimestamp} /> ago
          </DetailRow>
          <DetailRow label="Labels">
            <LabelList entries={policy.metadata?.labels} />
          </DetailRow>
          <DetailRow label="Annotations">
            <LabelList entries={policy.metadata?.annotations} />
          </DetailRow>
        </DetailGrid>
      ),
    },
  ],
});
