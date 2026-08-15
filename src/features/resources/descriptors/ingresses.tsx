/**
 * Ingresses.
 *
 * Two things `PaneIngresses` and `SidebarIngresses` got wrong, both of which made a
 * working Ingress look broken or a broken one look fine:
 *
 * - **The class came only from `spec.ingressClassName`.** Before that field existed the
 *   class was carried by the `kubernetes.io/ingress.class` annotation, and every chart
 *   that still supports Kubernetes 1.17 writes it that way — so a large share of real
 *   Ingresses showed `-` in the Class column while being served perfectly well.
 *   `ingressClass` below reads the field and falls back to the annotation, which is the
 *   order the controllers themselves use.
 * - **The rules were a YAML dump.** `TableYamlRow label="Rules"` printed the raw array.
 *   An Ingress is read to answer "which host and path reaches which Service on which
 *   port", and that is three levels of nesting down in that dump. It is a table here.
 *
 * The columns are `kubectl get ingress`'s: NAME, CLASS, HOSTS, ADDRESS, PORTS, AGE.
 */

import { For, Show } from 'solid-js';
import { Globe } from 'lucide-solid';
import type { V1HTTPIngressPath, V1Ingress, V1IngressBackend } from '@kubernetes/client-node';

import { deleteIngresses, listIngresses, updateIngress, watchIngresses } from '@/api/k8s/ingresses';
import { Badge } from '@/ui/Badge';

import { AgeCell, DetailGrid, DetailRow, LabelList, ageValue } from '../detail-parts';
import { defineResource } from '../types';

/** One shared empty array for the `?? []` defaults on the column accessors. */
const EMPTY = [] as const;

/** The pre-`ingressClassName` way of naming a controller. Still in wide use. */
const CLASS_ANNOTATION = 'kubernetes.io/ingress.class';

/* -------------------------------------------------------------------------- */
/* Derived values                                                             */
/* -------------------------------------------------------------------------- */

/** See the file header: the field wins, the legacy annotation is the fallback. */
const ingressClass = (ingress: V1Ingress): string | undefined =>
  ingress.spec?.ingressClassName ?? ingress.metadata?.annotations?.[CLASS_ANNOTATION];

/** Hosts listed before the fold. kubectl's limit. */
const MAX_HOSTS = 3;

/**
 * The HOSTS column, ported from kubectl's `formatHosts`.
 *
 * A rule with no `host` matches **every** hostname that reaches the controller, which
 * kubectl renders as `*`. Printing an em dash for it — as the React pane did for an
 * Ingress whose only rule was host-less — reads as "matches nothing".
 */
const hostsText = (ingress: V1Ingress): string => {
  const rules = ingress.spec?.rules ?? EMPTY;
  const listed: string[] = [];

  for (const rule of rules) {
    if (listed.length === MAX_HOSTS) break;
    listed.push(rule.host ?? '*');
  }

  if (listed.length === 0) return '*';
  const text = listed.join(', ');
  return rules.length > MAX_HOSTS ? `${text} + ${rules.length - MAX_HOSTS} more` : text;
};

/**
 * The ADDRESS column: where the controller is actually listening.
 *
 * Empty for a long time after creation, and empty forever if no controller claims the
 * class — which is why the Class column above matters.
 */
const addressText = (ingress: V1Ingress): string => {
  const addresses: string[] = [];
  for (const entry of ingress.status?.loadBalancer?.ingress ?? EMPTY) {
    const address = entry.ip ?? entry.hostname;
    if (address) addresses.push(address);
  }
  return addresses.join(', ');
};

/** Non-allocating sort key for the Address column. */
const firstAddress = (ingress: V1Ingress): string | undefined => {
  for (const entry of ingress.status?.loadBalancer?.ingress ?? EMPTY) {
    const address = entry.ip ?? entry.hostname;
    if (address) return address;
  }
  return undefined;
};

/**
 * The PORTS column.
 *
 * kubectl derives it from the presence of `spec.tls` rather than from anything in the
 * spec, because the port an Ingress is served on belongs to the controller, not to the
 * object. Both branches are string literals, so this allocates nothing.
 */
const portsText = (ingress: V1Ingress): string =>
  (ingress.spec?.tls ?? EMPTY).length > 0 ? '80, 443' : '80';

/**
 * `service:port`, or `apiGroup/Kind name` for a resource backend.
 *
 * A backend port may be a number or a *name* declared on the Service. A name that the
 * Service does not declare is accepted by the apiserver and 503s at request time, so it
 * is shown as written rather than resolved away.
 */
const backendText = (backend?: V1IngressBackend): string | undefined => {
  const service = backend?.service;
  if (service) {
    const port = service.port?.number ?? service.port?.name;
    return port === undefined ? service.name : `${service.name}:${port}`;
  }

  const resource = backend?.resource;
  if (resource) {
    const group = resource.apiGroup ? `${resource.apiGroup}/` : '';
    return `${group}${resource.kind} ${resource.name}`;
  }

  return undefined;
};

/**
 * `Prefix /api` — the path plus the matching rule that decides whether it applies.
 *
 * `pathType` is required and load-bearing: `Exact /api` and `Prefix /api` route
 * different requests, and the React YAML dump made them equally easy to miss.
 */
const pathText = (path: V1HTTPIngressPath): string => `${path.pathType} ${path.path ?? '/'}`;

/* -------------------------------------------------------------------------- */
/* Descriptor                                                                 */
/* -------------------------------------------------------------------------- */

export const ingressesDescriptor = defineResource({
  id: 'ingresses',
  kind: 'Ingress',
  title: 'Ingresses',
  group: 'network',
  icon: Globe,
  namespaced: true,

  api: {
    list: listIngresses,
    watch: watchIngresses,
    remove: deleteIngresses,
    update: updateIngress,
  },

  // Hosts and backend Service names are what people search an Ingress list for: they
  // arrive from a browser error page with a hostname, or from a Service they are trying
  // to find the route to.
  searchExtra: (ingress: V1Ingress) => {
    const values: (string | undefined)[] = [ingressClass(ingress), firstAddress(ingress)];
    for (const rule of ingress.spec?.rules ?? EMPTY) {
      values.push(rule.host);
      for (const path of rule.http?.paths ?? EMPTY) {
        values.push(path.path, path.backend.service?.name);
      }
    }
    for (const tls of ingress.spec?.tls ?? EMPTY) values.push(tls.secretName);
    return values;
  },

  columns: [
    {
      id: 'name',
      header: 'Name',
      width: 'minmax(180px, 2.2fr)',
      value: (ingress: V1Ingress) => ingress.metadata?.name,
    },
    {
      id: 'namespace',
      header: 'Namespace',
      width: 'minmax(110px, 1.2fr)',
      value: (ingress: V1Ingress) => ingress.metadata?.namespace,
    },
    {
      id: 'class',
      header: 'Class',
      width: 'minmax(90px, 1.2fr)',
      value: (ingress: V1Ingress) => ingressClass(ingress),
    },
    {
      id: 'hosts',
      header: 'Hosts',
      width: 'minmax(160px, 2.4fr)',
      // Sorted on the first host: a page of Ingresses sorted this way groups by domain,
      // which is what the column is scanned for. The full list is in the cell.
      value: (ingress: V1Ingress) => ingress.spec?.rules?.[0]?.host,
      cell: (ingress: V1Ingress) => (
        <span class="truncate" title={hostsText(ingress)}>
          {hostsText(ingress)}
        </span>
      ),
    },
    {
      id: 'address',
      header: 'Address',
      width: 'minmax(120px, 1.6fr)',
      value: (ingress: V1Ingress) => firstAddress(ingress),
      cell: (ingress: V1Ingress) => (
        <span class="truncate font-mono" title={addressText(ingress)}>
          {addressText(ingress)}
        </span>
      ),
    },
    {
      id: 'ports',
      header: 'Ports',
      width: '80px',
      value: (ingress: V1Ingress) => portsText(ingress),
    },
    {
      id: 'age',
      header: 'Age',
      width: '68px',
      align: 'right',
      value: (ingress: V1Ingress) => ageValue(ingress),
      cell: (ingress: V1Ingress) => <AgeCell timestamp={ingress.metadata?.creationTimestamp} />,
    },
  ],

  detail: [
    {
      id: 'rules',
      title: 'Rules',
      // First: the routing table is the object. Metadata is below it.
      render: (ingress: V1Ingress) => (
        <Show
          when={(ingress.spec?.rules ?? EMPTY).length > 0}
          fallback={
            <p class="text-2xs text-[var(--text-tertiary)]">
              No rules. Every request reaching this Ingress goes to the default backend.
            </p>
          }
        >
          <div class="flex flex-col gap-2">
            <For each={ingress.spec?.rules}>
              {(rule) => (
                <div class="rounded-sm border border-[var(--border-subtle)] bg-[var(--surface-inset)] p-2">
                  <div class="selectable mb-1.5 truncate font-medium text-[var(--text-primary)]">
                    {/* A host-less rule matches any hostname; see `hostsText`. */}
                    <Show when={rule.host} fallback={<span>* (any host)</span>}>
                      {(host) => host()}
                    </Show>
                  </div>

                  <Show
                    when={(rule.http?.paths ?? EMPTY).length > 0}
                    fallback={
                      <span class="text-2xs text-[var(--text-tertiary)]">No HTTP paths</span>
                    }
                  >
                    <div class="flex flex-col divide-y divide-[var(--border-subtle)]">
                      <For each={rule.http?.paths}>
                        {(path) => (
                          <div class="flex items-baseline gap-2 py-1">
                            <span class="selectable text-2xs min-w-0 flex-1 truncate font-mono text-[var(--text-primary)]">
                              {pathText(path)}
                            </span>
                            <span class="text-2xs shrink-0 text-[var(--text-tertiary)]">→</span>
                            <span class="selectable text-2xs min-w-0 flex-1 truncate font-mono text-[var(--code-key)]">
                              {backendText(path.backend)}
                            </span>
                          </div>
                        )}
                      </For>
                    </div>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </Show>
      ),
    },
    {
      id: 'routing',
      title: 'Class & TLS',
      render: (ingress: V1Ingress) => (
        <DetailGrid>
          <DetailRow label="Class">{ingress.spec?.ingressClassName}</DetailRow>
          {/* Shown separately from Class so it is obvious *which* of the two an Ingress
              relies on — the annotation is deprecated and some controllers have started
              ignoring it. */}
          <DetailRow label="Class annotation">
            {ingress.metadata?.annotations?.[CLASS_ANNOTATION]}
          </DetailRow>
          <DetailRow label="Address">
            <span class="font-mono">{addressText(ingress)}</span>
          </DetailRow>
          <DetailRow label="Default backend">
            {/* Serves everything that matches no rule. An Ingress with neither rules nor
                a default backend serves nothing at all. */}
            {backendText(ingress.spec?.defaultBackend)}
          </DetailRow>
          <DetailRow label="TLS">
            <Show
              when={(ingress.spec?.tls ?? EMPTY).length > 0}
              fallback={
                <span class="text-2xs text-[var(--text-tertiary)]">
                  None — served over HTTP only
                </span>
              }
            >
              <div class="flex flex-col gap-1">
                <For each={ingress.spec?.tls}>
                  {(tls) => (
                    <div class="flex flex-wrap items-baseline gap-1">
                      <Badge variant="neutral" size="sm">
                        {/* A TLS entry with no `secretName` falls back to the
                            controller's default certificate, which is almost never the
                            one the hosts below need. */}
                        <Show when={tls.secretName} fallback="default certificate">
                          {(secret) => secret()}
                        </Show>
                      </Badge>
                      <span class="selectable text-2xs text-[var(--text-secondary)]">
                        {(tls.hosts ?? EMPTY).join(', ')}
                      </span>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </DetailRow>
        </DetailGrid>
      ),
    },
    {
      id: 'metadata',
      title: 'Metadata',
      render: (ingress: V1Ingress) => (
        <DetailGrid>
          <DetailRow label="Name">{ingress.metadata?.name}</DetailRow>
          <DetailRow label="Namespace">{ingress.metadata?.namespace}</DetailRow>
          <DetailRow label="Created">
            <AgeCell timestamp={ingress.metadata?.creationTimestamp} /> ago
          </DetailRow>
          <DetailRow label="Labels">
            <LabelList entries={ingress.metadata?.labels} />
          </DetailRow>
          {/* Annotations are where every controller-specific behaviour lives — rewrites,
              body size limits, auth — so this list is worth more here than on most kinds. */}
          <DetailRow label="Annotations">
            <LabelList entries={ingress.metadata?.annotations} />
          </DetailRow>
        </DetailGrid>
      ),
    },
  ],
});
