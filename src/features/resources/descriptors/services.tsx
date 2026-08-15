/**
 * Services.
 *
 * `PaneServices` printed `spec.type` and `spec.clusterIP` and stopped there, which hides
 * the two things a Service list is scanned for:
 *
 * - **A `LoadBalancer` with no address.** By far the most common Service problem: the
 *   manifest is accepted, the type is `LoadBalancer`, and no cloud controller ever fills
 *   in `status.loadBalancer.ingress`, so nothing outside the cluster can reach it. There
 *   was no column in which that could show. `kubectl` prints `<pending>`; so does the
 *   External IP column here, in the warning hue, and `getServiceStatus` reports it in the
 *   detail header.
 * - **Node ports.** The React Ports column printed bare `spec.ports[].port`, so a
 *   `NodePort` Service looked identical to a `ClusterIP` one. `kubectl`'s notation is
 *   `port:nodePort/protocol` and that is what `portsText` produces.
 *
 * The column set is `kubectl get svc`'s, deliberately: this is the screen people arrive
 * at with a `kubectl` mental model, and an extra Status column would push External IP —
 * the column that carries the failure — off the visible width on a narrow window.
 */

import { For, Show } from 'solid-js';
import { Network } from 'lucide-solid';
import type { V1Service, V1ServicePort } from '@kubernetes/client-node';

import { deleteServices, listServices, updateService, watchServices } from '@/api/k8s/services';
import type { K8sStatus } from '@/types/k8sStatus';

import { AgeCell, DetailGrid, DetailRow, LabelList, ageValue } from '../detail-parts';
import { defineResource } from '../types';

/**
 * One shared empty array for the `?? []` defaults on the hot paths.
 *
 * Column accessors run per row per sort; a throwaway array in each of them is the
 * difference between sorting a list for free and sorting it for thousands of garbage
 * objects. Same reasoning as `pods.tsx`.
 */
const EMPTY = [] as const;

/* -------------------------------------------------------------------------- */
/* Addresses                                                                  */
/* -------------------------------------------------------------------------- */

/** True when the load balancer has actually been provisioned an address. */
const hasLoadBalancerAddress = (service: V1Service): boolean => {
  for (const ingress of service.status?.loadBalancer?.ingress ?? EMPTY) {
    if (ingress.ip ?? ingress.hostname) return true;
  }
  return false;
};

/**
 * The first address a client outside the cluster could use, or `undefined`.
 *
 * Scans rather than builds, because this is a column `value`. Sorting on the first
 * address groups a page of Services by the load balancer they sit behind, which is what
 * sorting this column is for; the cell renders all of them.
 */
const firstExternalAddress = (service: V1Service): string | undefined => {
  for (const ingress of service.status?.loadBalancer?.ingress ?? EMPTY) {
    const address = ingress.ip ?? ingress.hostname;
    if (address) return address;
  }
  return service.spec?.externalIPs?.[0] ?? service.spec?.externalName;
};

/** `<pending>`, spelled once so the cell and the tests of it cannot drift. */
const PENDING = '<pending>';

/**
 * The EXTERNAL-IP column, ported from kubectl's `getServiceExternalIP`.
 *
 * `spec.externalIPs` is included for every type because kube-proxy honours it without
 * any cloud provider involved — a `ClusterIP` Service with an external IP really is
 * reachable from outside, and the React sidebar was the only place that admitted it.
 */
const externalText = (service: V1Service): string => {
  const spec = service.spec;
  const type = spec?.type ?? 'ClusterIP';

  if (type === 'ExternalName') return spec?.externalName ?? '';

  const addresses: string[] = [];
  if (type === 'LoadBalancer') {
    for (const ingress of service.status?.loadBalancer?.ingress ?? EMPTY) {
      const address = ingress.ip ?? ingress.hostname;
      if (address) addresses.push(address);
    }
  }
  for (const ip of spec?.externalIPs ?? EMPTY) addresses.push(ip);

  if (addresses.length > 0) return addresses.join(', ');
  return type === 'LoadBalancer' ? PENDING : '';
};

/* -------------------------------------------------------------------------- */
/* Ports                                                                      */
/* -------------------------------------------------------------------------- */

/** `80/TCP`, or `80:31234/TCP` once a node port is allocated. kubectl's notation. */
const portText = (port: V1ServicePort): string => {
  const protocol = port.protocol ?? 'TCP';
  return port.nodePort ? `${port.port}:${port.nodePort}/${protocol}` : `${port.port}/${protocol}`;
};

const portsText = (service: V1Service): string =>
  (service.spec?.ports ?? EMPTY).map(portText).join(', ');

/**
 * `targetPort` is an `IntOrString`: a port number, or the *name* of a container port.
 * A named target that no container declares is a silent black hole, so the value is
 * always shown rather than folded into the port line.
 */
const targetPortText = (port: V1ServicePort): string | undefined =>
  port.targetPort === undefined ? undefined : String(port.targetPort);

/* -------------------------------------------------------------------------- */
/* Status                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * What state this Service is actually in, as opposed to what type it is.
 *
 * The type is already a column; repeating it as the status would waste the one field
 * that can say whether the Service works. Each branch is a state a reader has to act on:
 *
 * - A `LoadBalancer` with no address in `status` and none in `spec.externalIPs` is not
 *   reachable from outside, however healthy its endpoints are.
 * - `clusterIP: None` is a headless Service — no virtual IP, no proxying, DNS answers
 *   with the pod addresses. Named, because "no cluster IP" otherwise reads as a failure
 *   to allocate one.
 * - An `ExternalName` with no `externalName` resolves to nothing. The apiserver rejects
 *   it on create, but a stripped-down object from a bad `kubectl apply --force` can
 *   still arrive that way.
 *
 * Plain field reads and one loop bounded by the number of load balancer addresses.
 */
export const getServiceStatus = (service: V1Service): K8sStatus => {
  const spec = service.spec;
  const type = spec?.type ?? 'ClusterIP';

  if (type === 'LoadBalancer') {
    if (hasLoadBalancerAddress(service)) return { status: 'Active', variant: 'success' };
    if ((spec?.externalIPs?.length ?? 0) > 0) return { status: 'Active', variant: 'success' };
    return { status: 'Pending load balancer', variant: 'warning' };
  }

  if (type === 'ExternalName') {
    return spec?.externalName
      ? { status: 'ExternalName', variant: 'secondary' }
      : { status: 'No external name', variant: 'error' };
  }

  if (spec?.clusterIP === 'None') return { status: 'Headless', variant: 'secondary' };
  if (!spec?.clusterIP) return { status: 'Pending cluster IP', variant: 'warning' };
  return { status: 'Active', variant: 'success' };
};

/* -------------------------------------------------------------------------- */
/* Cells                                                                      */
/* -------------------------------------------------------------------------- */

interface ExternalCellProps {
  service: V1Service;
}

/**
 * The External IP cell, with `<pending>` in the warning hue.
 *
 * This is the only place a stuck `LoadBalancer` can be spotted while scanning, so the
 * colour is load-bearing rather than decoration.
 */
function ExternalCell(props: ExternalCellProps) {
  const text = () => externalText(props.service);

  return (
    <Show when={text()} fallback={<span class="text-[var(--text-tertiary)]">—</span>}>
      <span
        class={text() === PENDING ? 'truncate text-[var(--status-warn)]' : 'truncate'}
        title={text()}
      >
        {text()}
      </span>
    </Show>
  );
}

/* -------------------------------------------------------------------------- */
/* Descriptor                                                                 */
/* -------------------------------------------------------------------------- */

export const servicesDescriptor = defineResource({
  id: 'services',
  kind: 'Service',
  title: 'Services',
  group: 'network',
  icon: Network,
  namespaced: true,

  api: {
    list: listServices,
    watch: watchServices,
    remove: deleteServices,
    update: updateService,
  },

  status: getServiceStatus,

  // The selector is the searchable part: "which Service fronts `app=api`?" is a question
  // people actually ask a Service list.
  searchExtra: (service: V1Service) => [
    service.spec?.clusterIP,
    firstExternalAddress(service),
    ...Object.entries(service.spec?.selector ?? {}).map(([key, value]) => `${key}=${value}`),
    ...Object.entries(service.metadata?.labels ?? {}).map(([key, value]) => `${key}=${value}`),
  ],

  columns: [
    {
      id: 'name',
      header: 'Name',
      width: 'minmax(180px, 2.4fr)',
      value: (service: V1Service) => service.metadata?.name,
    },
    {
      id: 'namespace',
      header: 'Namespace',
      width: 'minmax(110px, 1.2fr)',
      value: (service: V1Service) => service.metadata?.namespace,
    },
    {
      id: 'type',
      header: 'Type',
      width: '108px',
      // An absent `type` means `ClusterIP`; sorting on `undefined` would scatter those
      // rows to the end of the list instead of grouping them with the other ClusterIPs.
      value: (service: V1Service) => service.spec?.type ?? 'ClusterIP',
    },
    {
      id: 'clusterIP',
      header: 'Cluster IP',
      width: 'minmax(110px, 1.3fr)',
      value: (service: V1Service) => service.spec?.clusterIP,
      cell: (service: V1Service) => (
        <span class="truncate font-mono">{service.spec?.clusterIP}</span>
      ),
    },
    {
      id: 'externalIP',
      header: 'External IP',
      width: 'minmax(120px, 1.6fr)',
      value: (service: V1Service) => firstExternalAddress(service),
      cell: (service: V1Service) => <ExternalCell service={service} />,
    },
    {
      id: 'ports',
      header: 'Ports',
      width: 'minmax(120px, 1.6fr)',
      // Sorted on the first port *number*, not on the rendered string: as text `443`
      // sorts before `80`, and `8080:31000/TCP` sorts before `80/TCP`.
      value: (service: V1Service) => service.spec?.ports?.[0]?.port,
      cell: (service: V1Service) => (
        <span class="tnum truncate" title={portsText(service)}>
          {portsText(service)}
        </span>
      ),
    },
    {
      id: 'age',
      header: 'Age',
      width: '68px',
      align: 'right',
      value: (service: V1Service) => ageValue(service),
      cell: (service: V1Service) => <AgeCell timestamp={service.metadata?.creationTimestamp} />,
    },
  ],

  detail: [
    {
      id: 'metadata',
      title: 'Metadata',
      render: (service: V1Service) => (
        <DetailGrid>
          <DetailRow label="Name">{service.metadata?.name}</DetailRow>
          <DetailRow label="Namespace">{service.metadata?.namespace}</DetailRow>
          <DetailRow label="Created">
            <AgeCell timestamp={service.metadata?.creationTimestamp} /> ago
          </DetailRow>
          <DetailRow label="Labels">
            <LabelList entries={service.metadata?.labels} />
          </DetailRow>
          <DetailRow label="Annotations">
            <LabelList entries={service.metadata?.annotations} />
          </DetailRow>
        </DetailGrid>
      ),
    },
    {
      id: 'networking',
      title: 'Networking',
      render: (service: V1Service) => (
        <DetailGrid>
          <DetailRow label="Type">{service.spec?.type ?? 'ClusterIP'}</DetailRow>
          <DetailRow label="Cluster IPs">
            {/* `clusterIPs` is the dual-stack form and `clusterIP` its first entry; a
                single-stack cluster sets both. Falling back keeps the row populated on
                servers old enough to send only the singular field. */}
            <span class="font-mono">
              {(service.spec?.clusterIPs ?? EMPTY).join(', ') || service.spec?.clusterIP}
            </span>
          </DetailRow>
          <DetailRow label="External IPs">
            <span class="font-mono">{(service.spec?.externalIPs ?? EMPTY).join(', ')}</span>
          </DetailRow>
          <DetailRow label="Load balancer">
            <Show
              when={hasLoadBalancerAddress(service)}
              fallback={
                <Show when={service.spec?.type === 'LoadBalancer'}>
                  <span class="text-[var(--status-warn)]">
                    No address assigned — nothing outside the cluster can reach this Service
                  </span>
                </Show>
              }
            >
              <div class="flex flex-col gap-0.5">
                <For each={service.status?.loadBalancer?.ingress}>
                  {(ingress) => (
                    <span class="text-2xs font-mono break-all">
                      {ingress.ip ?? ingress.hostname}
                    </span>
                  )}
                </For>
              </div>
            </Show>
          </DetailRow>
          <DetailRow label="External name">{service.spec?.externalName}</DetailRow>
          <DetailRow label="IP families">
            {(service.spec?.ipFamilies ?? EMPTY).join(', ')}
          </DetailRow>
          <DetailRow label="Session affinity">{service.spec?.sessionAffinity}</DetailRow>
          {/* Only meaningful with `sessionAffinity: ClientIP`, and the one number that
              explains why a "sticky" session stopped being sticky. */}
          <DetailRow label="Affinity timeout">
            <Show when={service.spec?.sessionAffinityConfig?.clientIP?.timeoutSeconds}>
              {(seconds) => <>{seconds()}s</>}
            </Show>
          </DetailRow>
          {/* `Local` preserves the client source IP but black-holes traffic that lands on
              a node with no local endpoint — the reason a NodePort works from some nodes
              and not others. */}
          <DetailRow label="External traffic">{service.spec?.externalTrafficPolicy}</DetailRow>
          <DetailRow label="Internal traffic">{service.spec?.internalTrafficPolicy}</DetailRow>
          <DetailRow label="LB class">{service.spec?.loadBalancerClass}</DetailRow>
          <DetailRow label="Health node port">{service.spec?.healthCheckNodePort}</DetailRow>
        </DetailGrid>
      ),
    },
    {
      id: 'selector',
      title: 'Selector',
      render: (service: V1Service) => (
        <Show
          when={Object.keys(service.spec?.selector ?? {}).length > 0}
          fallback={
            <p class="text-2xs text-[var(--text-tertiary)]">
              {/* Legitimate for the `kubernetes` Service and for any Service fronting an
                  external system, so this is a note rather than a warning — but it does
                  mean nothing is filling the Endpoints in automatically. */}
              No selector. Endpoints for this Service are managed manually.
            </p>
          }
        >
          <LabelList entries={service.spec?.selector} />
        </Show>
      ),
    },
    {
      id: 'ports',
      title: 'Ports',
      render: (service: V1Service) => (
        <Show
          when={(service.spec?.ports ?? EMPTY).length > 0}
          fallback={<span class="text-2xs text-[var(--text-tertiary)]">None</span>}
        >
          <div class="flex flex-col divide-y divide-[var(--border-subtle)]">
            <For each={service.spec?.ports}>
              {(port) => (
                <div class="py-1">
                  <div class="flex items-baseline gap-2">
                    <span class="selectable tnum min-w-0 flex-1 font-mono text-[var(--text-primary)]">
                      {portText(port)}
                    </span>
                    <Show when={port.name}>
                      <span class="text-2xs shrink-0 text-[var(--text-secondary)]">
                        {port.name}
                      </span>
                    </Show>
                  </div>
                  <div class="text-2xs text-[var(--text-tertiary)]">
                    <Show when={targetPortText(port)} fallback="target port not set">
                      {(target) => <>target {target()}</>}
                    </Show>
                    <Show when={port.appProtocol}>{(protocol) => <> · {protocol()}</>}</Show>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
      ),
    },
  ],
});
