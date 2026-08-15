/**
 * IngressClasses. Cluster-scoped.
 *
 * Three fields, and the one that matters most was in neither the React pane nor its
 * sidebar: **which class is the default**. It is not a field — it is the annotation
 * `ingressclass.kubernetes.io/is-default-class` being the string `"true"` — and it decides
 * where every Ingress created without an explicit `ingressClassName` ends up. With it
 * hidden, "my Ingress went to the wrong controller" is unanswerable from this screen.
 *
 * `SidebarIngressClass` also printed `spec.parameters` as a YAML dump. A parameters
 * reference is four short fields, one of which (`scope`) changes whether `namespace` is
 * read at all, so it is a labelled grid here.
 */

import { Show } from 'solid-js';
import { Layers } from 'lucide-solid';
import type { V1IngressClass } from '@kubernetes/client-node';

import {
  deleteIngressClasses,
  listIngressClasses,
  updateIngressClass,
  watchIngressClasses,
} from '@/api/k8s/ingressClasses';
import { Badge } from '@/ui/Badge';

import { AgeCell, DetailGrid, DetailRow, LabelList, ageValue } from '../detail-parts';
import { defineResource } from '../types';

const DEFAULT_ANNOTATION = 'ingressclass.kubernetes.io/is-default-class';

/**
 * Whether this class receives Ingresses that name no class.
 *
 * The annotation is a *string*; only the exact value `"true"` counts, which is why this
 * is not a truthiness check — `"false"` is also a non-empty string.
 */
const isDefault = (ingressClass: V1IngressClass): boolean =>
  ingressClass.metadata?.annotations?.[DEFAULT_ANNOTATION] === 'true';

/**
 * `Cluster` or `Namespace`, defaulted the way the API defaults it.
 *
 * With `scope: Namespace` the `namespace` field is required and the parameters object is
 * looked up there; with `Cluster` — the default — `namespace` is ignored even if set.
 */
const parametersScope = (ingressClass: V1IngressClass): string =>
  ingressClass.spec?.parameters?.scope ?? 'Cluster';

export const ingressClassesDescriptor = defineResource({
  id: 'ingressClasses',
  kind: 'IngressClass',
  title: 'Ingress Classes',
  group: 'network',
  icon: Layers,
  namespaced: false,

  // Cluster-scoped: `list_ingress_classes` and `delete_ingress_classes` take no
  // namespace, so these accept `{ name }` and `{ name, resourceNames }` and are
  // assignable to `ResourceApi<T>` as they are.
  api: {
    list: listIngressClasses,
    watch: watchIngressClasses,
    remove: deleteIngressClasses,
    update: updateIngressClass,
  },

  searchExtra: (ingressClass: V1IngressClass) => [
    ingressClass.spec?.controller,
    ingressClass.spec?.parameters?.name,
    ...Object.entries(ingressClass.metadata?.labels ?? {}).map(([key, value]) => `${key}=${value}`),
  ],

  columns: [
    {
      id: 'name',
      header: 'Name',
      width: 'minmax(180px, 2fr)',
      value: (ingressClass: V1IngressClass) => ingressClass.metadata?.name,
    },
    {
      id: 'controller',
      header: 'Controller',
      width: 'minmax(180px, 3fr)',
      value: (ingressClass: V1IngressClass) => ingressClass.spec?.controller,
      cell: (ingressClass: V1IngressClass) => (
        <span class="truncate font-mono" title={ingressClass.spec?.controller}>
          {ingressClass.spec?.controller}
        </span>
      ),
    },
    {
      id: 'default',
      header: 'Default',
      width: '84px',
      // Sorted on the boolean so descending groups the default class first — there should
      // be exactly one, and finding it is the reason this column exists.
      value: (ingressClass: V1IngressClass) => isDefault(ingressClass),
      cell: (ingressClass: V1IngressClass) => (
        <Show
          when={isDefault(ingressClass)}
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
      value: (ingressClass: V1IngressClass) => ageValue(ingressClass),
      cell: (ingressClass: V1IngressClass) => (
        <AgeCell timestamp={ingressClass.metadata?.creationTimestamp} />
      ),
    },
  ],

  detail: [
    {
      id: 'metadata',
      title: 'Metadata',
      render: (ingressClass: V1IngressClass) => (
        <DetailGrid>
          <DetailRow label="Name">{ingressClass.metadata?.name}</DetailRow>
          <DetailRow label="Controller">
            <span class="font-mono">{ingressClass.spec?.controller}</span>
          </DetailRow>
          <DetailRow label="Default">
            <Show when={isDefault(ingressClass)} fallback="No">
              Yes — Ingresses that name no class are handled by this controller
            </Show>
          </DetailRow>
          <DetailRow label="Created">
            <AgeCell timestamp={ingressClass.metadata?.creationTimestamp} /> ago
          </DetailRow>
          <DetailRow label="Labels">
            <LabelList entries={ingressClass.metadata?.labels} />
          </DetailRow>
          <DetailRow label="Annotations">
            <LabelList entries={ingressClass.metadata?.annotations} />
          </DetailRow>
        </DetailGrid>
      ),
    },
    {
      id: 'parameters',
      title: 'Parameters',
      render: (ingressClass: V1IngressClass) => (
        <Show
          when={ingressClass.spec?.parameters}
          fallback={
            <p class="text-2xs text-[var(--text-tertiary)]">
              None. This controller is configured entirely outside the IngressClass.
            </p>
          }
        >
          {(parameters) => (
            <DetailGrid>
              <DetailRow label="Kind">
                {/* `apiGroup` is absent for core objects (a ConfigMap), which is a
                    meaningful distinction from a CRD in some other group. */}
                {parameters().apiGroup
                  ? `${parameters().apiGroup}/${parameters().kind}`
                  : parameters().kind}
              </DetailRow>
              <DetailRow label="Name">{parameters().name}</DetailRow>
              <DetailRow label="Scope">{parametersScope(ingressClass)}</DetailRow>
              <DetailRow label="Namespace">
                {/* Read only when the scope is `Namespace`; showing it otherwise would
                    imply a lookup that does not happen. */}
                <Show when={parametersScope(ingressClass) === 'Namespace'}>
                  {parameters().namespace}
                </Show>
              </DetailRow>
            </DetailGrid>
          )}
        </Show>
      ),
    },
  ],
});
