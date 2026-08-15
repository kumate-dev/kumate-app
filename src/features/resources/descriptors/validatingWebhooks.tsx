/**
 * ValidatingWebhookConfigurations. Cluster-scoped.
 *
 * `SidebarValidatingWebhooks` printed a count and then `TableYamlRow label="webhooks"` —
 * the entire `webhooks` array as raw YAML, `caBundle` included. That is a kilobyte of
 * base64 per webhook, wrapped into a 300px panel, and it buried the one field that decides
 * whether this object can take a cluster down.
 *
 * **`failurePolicy: Fail` means the apiserver rejects every matching request when the
 * webhook endpoint is unreachable.** Point one at a Service whose pods are gone, with
 * `rules` matching `*`, and nothing can be created cluster-wide — including the pods that
 * would bring the webhook back. It is the classic self-inflicted outage, and `Fail` is
 * also the value the API *defaults to* when the field is absent, which is why an unset
 * policy is rendered as `Fail (default)` rather than as an empty row.
 *
 * ## Shared with `mutatingWebhooks.tsx`
 *
 * Everything below `AdmissionWebhook` is exported and reused there. `V1ValidatingWebhook`
 * and `V1MutatingWebhook` are the same shape apart from `reinvocationPolicy`, which the
 * card renders only when it is present — so mutating webhooks need no second copy of any
 * of this, and the two React files that differed by one word do not come back.
 *
 * Checked for the renamed-wire-field trap (`V1NetworkPolicyIngressRule._from`,
 * `V1LimitRangeItem._default`): none of `V1ValidatingWebhook`, `V1RuleWithOperations`,
 * `AdmissionregistrationV1WebhookClientConfig` or `V1MatchCondition` contains a reserved
 * word, so every property here is the wire name and reads correctly off the raw JSON the
 * Tauri commands return.
 */

import { For, Show } from 'solid-js';
import { Webhook } from 'lucide-solid';
import type {
  AdmissionregistrationV1WebhookClientConfig,
  V1LabelSelector,
  V1MatchCondition,
  V1RuleWithOperations,
  V1ValidatingWebhookConfiguration,
} from '@kubernetes/client-node';

import {
  deleteValidatingWebhooks,
  listValidatingWebhooks,
  updateValidatingWebhook,
  watchValidatingWebhooks,
} from '@/api/k8s/validatingWebhooks';
import { Badge } from '@/ui/Badge';

import { AgeCell, DetailGrid, DetailRow, LabelList, ageValue } from '../detail-parts';
import { defineResource } from '../types';

/** One shared empty array for the `?? []` defaults on the hot paths. */
const EMPTY = [] as const;

/**
 * The fields `V1ValidatingWebhook` and `V1MutatingWebhook` share, plus the one they do not.
 *
 * Both generated classes satisfy this structurally, so neither kind needs a cast and
 * `reinvocationPolicy` — mutating only — is simply absent on a validating webhook and
 * omitted from the card.
 */
export interface AdmissionWebhook {
  name: string;
  clientConfig: AdmissionregistrationV1WebhookClientConfig;
  rules?: readonly V1RuleWithOperations[];
  failurePolicy?: string;
  matchPolicy?: string;
  sideEffects: string;
  timeoutSeconds?: number;
  admissionReviewVersions: readonly string[];
  namespaceSelector?: V1LabelSelector;
  objectSelector?: V1LabelSelector;
  matchConditions?: readonly V1MatchCondition[];
  /** Mutating webhooks only. */
  reinvocationPolicy?: string;
}

export const webhookCount = (webhooks?: readonly AdmissionWebhook[]): number =>
  webhooks?.length ?? 0;

/* -------------------------------------------------------------------------- */
/* Failure policy                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Whether an unreachable endpoint blocks the request.
 *
 * `admissionregistration.k8s.io/v1` defaults `failurePolicy` to `Fail`, so an absent field
 * is the dangerous value, not the safe one. Treating `undefined` as "unknown" here would
 * understate the risk on exactly the objects nobody configured deliberately.
 */
const failsClosed = (webhook: AdmissionWebhook): boolean =>
  (webhook.failurePolicy ?? 'Fail') === 'Fail';

const failurePolicyLabel = (webhook: AdmissionWebhook): string =>
  webhook.failurePolicy ?? 'Fail (default)';

export const anyFailsClosed = (webhooks?: readonly AdmissionWebhook[]): boolean => {
  for (const webhook of webhooks ?? EMPTY) {
    if (failsClosed(webhook)) return true;
  }
  return false;
};

/* -------------------------------------------------------------------------- */
/* Client config                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Where the apiserver sends the review: a Service, or a URL.
 *
 * Exactly one of the two is set. The Service form is rendered the way the endpoint is
 * actually addressed — `namespace/name:port path` — so it can be compared against a
 * Service list without translating anything in the reader's head. `caBundle` is
 * deliberately not shown: it is a kilobyte of base64 that pushes everything useful off
 * the panel, which is precisely what the React sidebar did.
 */
const targetText = (config?: AdmissionregistrationV1WebhookClientConfig): string | undefined => {
  if (config?.url) return config.url;

  const service = config?.service;
  if (!service) return undefined;

  const port = service.port === undefined ? '' : `:${service.port}`;
  const path = service.path ?? '';
  return `${service.namespace}/${service.name}${port}${path}`;
};

/* -------------------------------------------------------------------------- */
/* Selectors and rules                                                        */
/* -------------------------------------------------------------------------- */

/** `key in (a,b)` — the notation `kubectl describe` uses for a selector expression. */
const expressionText = (expression: {
  key: string;
  operator: string;
  values?: string[];
}): string => {
  if (expression.operator === 'Exists') return expression.key;
  if (expression.operator === 'DoesNotExist') return `!${expression.key}`;
  const values = (expression.values ?? EMPTY).join(',');
  return `${expression.key} ${expression.operator.toLowerCase()} (${values})`;
};

/**
 * A label selector as text, with the empty case spelled out.
 *
 * An absent or empty selector on a webhook does not mean "matches nothing", it means
 * "matches everything" — the difference between a webhook that sees one namespace and one
 * that sees every request in the cluster.
 */
const selectorText = (selector: V1LabelSelector | undefined, all: string): string => {
  if (selector === undefined) return all;

  const parts: string[] = [];
  for (const [key, value] of Object.entries(selector.matchLabels ?? {})) {
    parts.push(`${key}=${value}`);
  }
  for (const expression of selector.matchExpressions ?? EMPTY) {
    parts.push(expressionText(expression));
  }

  return parts.length === 0 ? all : parts.join(', ');
};

/** The core API group is the empty string; a blank cell would read as "unrestricted". */
const groupText = (group: string): string => (group === '' ? 'core' : group);

/** `apps/v1: deployments, deployments/scale` — what this rule intercepts. */
const ruleTargetText = (rule: V1RuleWithOperations): string => {
  const groups = (rule.apiGroups ?? EMPTY).map(groupText).join(',') || '—';
  const versions = (rule.apiVersions ?? EMPTY).join(',') || '—';
  const resources = (rule.resources ?? EMPTY).join(', ') || '—';
  return `${groups}/${versions}: ${resources}`;
};

interface RuleListProps {
  rules?: readonly V1RuleWithOperations[];
}

function RuleList(props: RuleListProps) {
  return (
    <Show
      when={(props.rules ?? EMPTY).length > 0}
      fallback={
        <span class="text-2xs text-[var(--text-tertiary)]">
          No rules — this webhook is never called.
        </span>
      }
    >
      <div class="flex flex-col gap-1.5">
        <For each={props.rules}>
          {(rule) => (
            <div class="flex flex-col gap-0.5">
              <div class="flex flex-wrap gap-1">
                <For each={rule.operations}>
                  {(operation) => (
                    // `*` covers CREATE, UPDATE, DELETE and CONNECT, including operations
                    // added by future API versions.
                    <Badge variant={operation === '*' ? 'warn' : 'neutral'} size="sm">
                      {operation}
                    </Badge>
                  )}
                </For>
              </div>
              <span class="selectable text-2xs font-mono break-all text-[var(--text-primary)]">
                {ruleTargetText(rule)}
              </span>
              <span class="text-2xs text-[var(--text-tertiary)]">
                {/* `*` is the default and means both cluster-scoped and namespaced. */}
                scope {rule.scope ?? '*'}
              </span>
            </div>
          )}
        </For>
      </div>
    </Show>
  );
}

/* -------------------------------------------------------------------------- */
/* Webhook card                                                               */
/* -------------------------------------------------------------------------- */

export interface WebhookCardProps {
  webhook: AdmissionWebhook;
}

export function WebhookCard(props: WebhookCardProps) {
  return (
    <div class="rounded-sm border border-[var(--border-subtle)] bg-[var(--surface-inset)] p-2">
      <div class="mb-1.5 flex items-center gap-2">
        <span class="selectable min-w-0 flex-1 truncate font-medium text-[var(--text-primary)]">
          {props.webhook.name}
        </span>
        {/* The badge sits in the card header rather than in a row of its own because it is
            the field that decides whether this webhook can break the cluster. */}
        <Badge variant={failsClosed(props.webhook) ? 'warn' : 'neutral'} size="sm">
          {failurePolicyLabel(props.webhook)}
        </Badge>
      </div>

      <DetailGrid>
        <DetailRow label="Target">
          <span class="text-2xs font-mono break-all">{targetText(props.webhook.clientConfig)}</span>
        </DetailRow>
        <DetailRow label="Failure policy">
          <Show
            when={failsClosed(props.webhook)}
            fallback={<>{failurePolicyLabel(props.webhook)}</>}
          >
            <span class="text-[var(--status-warn)]">
              {failurePolicyLabel(props.webhook)} — matching requests are rejected while this
              endpoint is unreachable.
            </span>
          </Show>
        </DetailRow>
        <DetailRow label="Side effects">{props.webhook.sideEffects}</DetailRow>
        <DetailRow label="Match policy">
          {/* `Equivalent` is the default and the one that closes the loophole: without it a
              rule on `apps/v1` misses the same object submitted as `extensions/v1beta1`. */}
          {props.webhook.matchPolicy ?? 'Equivalent (default)'}
        </DetailRow>
        <DetailRow label="Timeout">
          <Show when={props.webhook.timeoutSeconds} fallback="10s (default)">
            {(seconds) => <>{seconds()}s</>}
          </Show>
        </DetailRow>
        <DetailRow label="Review versions">
          {props.webhook.admissionReviewVersions.join(', ')}
        </DetailRow>
        <Show when={props.webhook.reinvocationPolicy}>
          {(policy) => (
            <DetailRow label="Reinvocation">
              {/* `IfNeeded` re-runs this webhook when a later one modified the object, so
                  its patch must be idempotent. */}
              {policy()}
            </DetailRow>
          )}
        </Show>
        <DetailRow label="Namespaces">
          {selectorText(props.webhook.namespaceSelector, 'All namespaces')}
        </DetailRow>
        <DetailRow label="Objects">
          {selectorText(props.webhook.objectSelector, 'All objects')}
        </DetailRow>
        <Show when={(props.webhook.matchConditions ?? EMPTY).length > 0}>
          <DetailRow label="Match conditions">
            <div class="flex flex-col gap-0.5">
              <For each={props.webhook.matchConditions}>
                {(condition) => (
                  <span class="text-2xs font-mono break-all">
                    {condition.name}: {condition.expression}
                  </span>
                )}
              </For>
            </div>
          </DetailRow>
        </Show>
      </DetailGrid>

      <div class="mt-2 border-t border-[var(--border-subtle)] pt-2">
        <div class="text-2xs mb-1 text-[var(--text-tertiary)]">Rules</div>
        <RuleList rules={props.webhook.rules} />
      </div>
    </div>
  );
}

export interface WebhookListProps {
  webhooks?: readonly AdmissionWebhook[];
  /** `mutate` or `validate` — the verb used in the fail-closed warning. */
  verb: string;
}

/** Every webhook in the configuration, with the fail-closed warning ahead of them. */
export function WebhookList(props: WebhookListProps) {
  return (
    <Show
      when={webhookCount(props.webhooks) > 0}
      fallback={
        <p class="text-2xs text-[var(--text-tertiary)]">
          No webhooks. This configuration does nothing.
        </p>
      }
    >
      <div class="flex flex-col gap-2">
        <Show when={anyFailsClosed(props.webhooks)}>
          <p class="text-2xs text-[var(--status-warn)]">
            At least one webhook here fails closed: while its endpoint is unreachable the apiserver
            will refuse every request it would {props.verb}.
          </p>
        </Show>
        <For each={props.webhooks}>{(webhook) => <WebhookCard webhook={webhook} />}</For>
      </div>
    </Show>
  );
}

/**
 * Search terms shared by both webhook kinds: the endpoint and the resources intercepted.
 *
 * Neither is in a column, and both are what someone arrives with — "which webhook is
 * rejecting my Deployment?" and "what is still pointing at this Service?".
 */
export const webhookSearchTerms = (
  webhooks: readonly AdmissionWebhook[] | undefined,
  labels: Record<string, string> | undefined
): (string | undefined)[] => {
  const terms: (string | undefined)[] = [];
  for (const webhook of webhooks ?? EMPTY) {
    terms.push(webhook.name);
    terms.push(targetText(webhook.clientConfig));
    for (const rule of webhook.rules ?? EMPTY) {
      for (const resource of rule.resources ?? EMPTY) terms.push(resource);
    }
  }
  for (const [key, value] of Object.entries(labels ?? {})) terms.push(`${key}=${value}`);
  return terms;
};

/* -------------------------------------------------------------------------- */
/* Descriptor                                                                 */
/* -------------------------------------------------------------------------- */

export const validatingWebhooksDescriptor = defineResource({
  id: 'validatingWebhooks',
  kind: 'ValidatingWebhookConfiguration',
  title: 'Validating Webhooks',
  group: 'cluster',
  icon: Webhook,
  namespaced: false,

  // Cluster-scoped: `list_validating_webhooks` takes `{ name }` and
  // `delete_validating_webhooks` `{ name, resourceNames }`.
  api: {
    list: listValidatingWebhooks,
    watch: watchValidatingWebhooks,
    remove: deleteValidatingWebhooks,
    update: updateValidatingWebhook,
  },

  searchExtra: (config: V1ValidatingWebhookConfiguration) =>
    webhookSearchTerms(config.webhooks, config.metadata?.labels),

  columns: [
    {
      id: 'name',
      header: 'Name',
      width: 'minmax(220px, 4fr)',
      value: (config: V1ValidatingWebhookConfiguration) => config.metadata?.name,
    },
    {
      id: 'webhooks',
      header: 'Webhooks',
      width: '84px',
      align: 'right',
      value: (config: V1ValidatingWebhookConfiguration) => webhookCount(config.webhooks),
      cell: (config: V1ValidatingWebhookConfiguration) => (
        <span class="tnum">{webhookCount(config.webhooks)}</span>
      ),
    },
    {
      id: 'age',
      header: 'Age',
      width: '68px',
      align: 'right',
      value: (config: V1ValidatingWebhookConfiguration) => ageValue(config),
      cell: (config: V1ValidatingWebhookConfiguration) => (
        <AgeCell timestamp={config.metadata?.creationTimestamp} />
      ),
    },
  ],

  detail: [
    {
      id: 'webhooks',
      title: 'Webhooks',
      // First section: the configuration object itself carries nothing else.
      render: (config: V1ValidatingWebhookConfiguration) => (
        <WebhookList webhooks={config.webhooks} verb="validate" />
      ),
    },
    {
      id: 'metadata',
      title: 'Metadata',
      render: (config: V1ValidatingWebhookConfiguration) => (
        <DetailGrid>
          <DetailRow label="Name">{config.metadata?.name}</DetailRow>
          <DetailRow label="Created">
            <AgeCell timestamp={config.metadata?.creationTimestamp} /> ago
          </DetailRow>
          <DetailRow label="Webhooks">{webhookCount(config.webhooks)}</DetailRow>
          <DetailRow label="Labels">
            <LabelList entries={config.metadata?.labels} />
          </DetailRow>
          <DetailRow label="Annotations">
            {/* cert-manager and similar operators write the CA injection marker here, which
                is what keeps `caBundle` current. */}
            <LabelList entries={config.metadata?.annotations} />
          </DetailRow>
        </DetailGrid>
      ),
    },
  ],
});
