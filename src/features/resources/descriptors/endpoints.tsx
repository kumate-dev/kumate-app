/**
 * Endpoints.
 *
 * An Endpoints object exists to answer one question: **is anything behind this Service?**
 * The React screen could not answer it. `PaneEndpoints` had three columns — name,
 * namespace, age — and `SidebarEndpoints` printed `subsets.length` and then dumped the
 * whole `subsets` array as YAML. A Service silently black-holing every request looked
 * exactly like a healthy one, because "1 subset" is what both of them say: a subset with
 * only `notReadyAddresses` still counts as a subset.
 *
 * So the addresses are the table here, split into ready and not-ready everywhere they
 * appear, and an object with nothing ready reads as an error rather than as a row.
 *
 * The Endpoints column is a port of kubectl's `formatEndpoints`, including the `+ N more`
 * fold: a Service in front of a 200-pod Deployment has 200 addresses and there is no
 * useful cell that contains them.
 */

import { For, Show } from 'solid-js';
import { Share2 } from 'lucide-solid';
import type {
  CoreV1EndpointPort,
  V1EndpointAddress,
  V1EndpointSubset,
  V1Endpoints,
} from '@kubernetes/client-node';

import {
  deleteEndpoints,
  listEndpoints,
  updateEndpoints,
  watchEndpoints,
} from '@/api/k8s/endpoints';
import type { K8sStatus } from '@/types/k8sStatus';
import { Badge } from '@/ui/Badge';
import { StatusBadge } from '@/ui/StatusBadge';

import { AgeCell, DetailGrid, DetailRow, LabelList, ageValue } from '../detail-parts';
import { defineResource } from '../types';

/** One shared empty array for the `?? []` defaults on the column accessors. */
const EMPTY = [] as const;

/* -------------------------------------------------------------------------- */
/* Counts                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Addresses a Service will actually send traffic to.
 *
 * Counted rather than collected: this is the sort value for the Endpoints column, so it
 * must not allocate, and "how many backends does this have" is a more useful ordering
 * than the alphabetical order of the first IP anyway.
 */
const readyCount = (endpoints: V1Endpoints): number => {
  let total = 0;
  for (const subset of endpoints.subsets ?? EMPTY) total += subset.addresses?.length ?? 0;
  return total;
};

const notReadyCount = (endpoints: V1Endpoints): number => {
  let total = 0;
  for (const subset of endpoints.subsets ?? EMPTY) total += subset.notReadyAddresses?.length ?? 0;
  return total;
};

/* -------------------------------------------------------------------------- */
/* Text                                                                       */
/* -------------------------------------------------------------------------- */

/** Addresses listed in the cell before the fold. kubectl's limit, and it is the right one. */
const MAX_LISTED = 3;

/**
 * `ip:port`, bracketing IPv6 the way `net.JoinHostPort` does.
 *
 * Without the brackets `fd00::1:8080` is ambiguous — the last colon could belong to the
 * address — and dual-stack clusters are common enough that this is not hypothetical.
 */
const hostPort = (ip: string, port: number): string =>
  ip.includes(':') ? `[${ip}]:${port}` : `${ip}:${port}`;

/**
 * The ENDPOINTS column, ported from kubectl's `formatEndpoints`.
 *
 * Only `subsets[].addresses` are listed. `notReadyAddresses` are real addresses but no
 * Service routes to them, so including them here would make a black-holing Service look
 * served — the exact confusion this screen exists to remove. The not-ready count is
 * reported separately by `getEndpointsStatus` and in full in the detail panel.
 */
const endpointsText = (endpoints: V1Endpoints): string => {
  const listed: string[] = [];
  let count = 0;

  for (const subset of endpoints.subsets ?? EMPTY) {
    const addresses = subset.addresses ?? EMPTY;
    const ports = subset.ports ?? EMPTY;

    // A subset with addresses but no ports is legal and means "all ports"; kubectl prints
    // the bare addresses for it.
    if (ports.length === 0) {
      for (const address of addresses) {
        if (count < MAX_LISTED) listed.push(address.ip);
        count += 1;
      }
      continue;
    }

    for (const port of ports) {
      for (const address of addresses) {
        if (count < MAX_LISTED) listed.push(hostPort(address.ip, port.port));
        count += 1;
      }
    }
  }

  if (count === 0) return '';
  const text = listed.join(', ');
  return count > MAX_LISTED ? `${text} + ${count - MAX_LISTED} more` : text;
};

/** `8080/TCP (http)` — the ports one subset exposes. */
const portText = (port: CoreV1EndpointPort): string => {
  const base = `${port.port}/${port.protocol ?? 'TCP'}`;
  return port.name ? `${base} (${port.name})` : base;
};

/**
 * The pod (or other object) an address belongs to.
 *
 * `targetRef` is the only link from an IP back to something a person can act on, and it
 * is missing for manually managed Endpoints — which is itself worth seeing.
 */
const targetText = (address: V1EndpointAddress): string | undefined => {
  const target = address.targetRef;
  if (!target?.name) return undefined;
  return `${target.kind ?? 'Object'}/${target.name}`;
};

/* -------------------------------------------------------------------------- */
/* Status                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Whether this Endpoints object is routing anything.
 *
 * `No endpoints` and `None ready` are separated on purpose: the first means nothing
 * matched the Service's selector (wrong labels, wrong namespace, zero replicas), the
 * second means pods matched and are failing their readiness probe. Those have completely
 * different fixes, and both were previously reported as "1 subset".
 */
export const getEndpointsStatus = (endpoints: V1Endpoints): K8sStatus => {
  const ready = readyCount(endpoints);
  const notReady = notReadyCount(endpoints);

  if (ready === 0) {
    return notReady === 0
      ? { status: 'No endpoints', variant: 'error' }
      : { status: 'None ready', variant: 'error' };
  }
  if (notReady > 0) return { status: 'Partially ready', variant: 'warning' };
  return { status: 'Ready', variant: 'success' };
};

/* -------------------------------------------------------------------------- */
/* Cells                                                                      */
/* -------------------------------------------------------------------------- */

interface EndpointsCellProps {
  endpoints: V1Endpoints;
}

/**
 * The Endpoints cell, with the empty case in the danger hue.
 *
 * `<none>` is not a neutral value here: it is the single most likely explanation for a
 * Service that times out, so it has to be findable while scrolling rather than only in
 * the detail panel.
 */
function EndpointsCell(props: EndpointsCellProps) {
  const text = () => endpointsText(props.endpoints);

  return (
    <Show when={text()} fallback={<span class="text-[var(--status-danger)]">&lt;none&gt;</span>}>
      <span class="tnum truncate font-mono" title={text()}>
        {text()}
      </span>
    </Show>
  );
}

interface AddressListProps {
  addresses?: V1EndpointAddress[];
  ready: boolean;
}

/** Addresses of one subset, one row each, with the pod they resolve to. */
function AddressList(props: AddressListProps) {
  return (
    <Show
      when={(props.addresses ?? EMPTY).length > 0}
      fallback={<span class="text-2xs text-[var(--text-tertiary)]">None</span>}
    >
      <div class="flex flex-col gap-0.5">
        <For each={props.addresses}>
          {(address) => (
            <div class="flex items-baseline gap-2">
              <span
                class={
                  props.ready
                    ? 'selectable text-2xs shrink-0 font-mono text-[var(--status-ok)]'
                    : 'selectable text-2xs shrink-0 font-mono text-[var(--status-warn)]'
                }
              >
                {address.ip}
              </span>
              <span class="text-2xs min-w-0 flex-1 truncate text-[var(--text-secondary)]">
                <Show when={targetText(address)} fallback="no target reference">
                  {(target) => target()}
                </Show>
              </span>
              <Show when={address.nodeName}>
                {(node) => (
                  <span class="text-2xs shrink-0 truncate text-[var(--text-tertiary)]">
                    {node()}
                  </span>
                )}
              </Show>
            </div>
          )}
        </For>
      </div>
    </Show>
  );
}

interface SubsetCardProps {
  subset: V1EndpointSubset;
  index: number;
}

function SubsetCard(props: SubsetCardProps) {
  return (
    <div class="rounded-sm border border-[var(--border-subtle)] bg-[var(--surface-inset)] p-2">
      <div class="mb-1.5 flex items-center gap-2">
        <span class="min-w-0 flex-1 truncate font-medium text-[var(--text-primary)]">
          Subset {props.index + 1}
        </span>
        <Badge variant={(props.subset.addresses ?? EMPTY).length > 0 ? 'ok' : 'danger'} size="sm">
          {(props.subset.addresses ?? EMPTY).length} ready
        </Badge>
      </div>

      <DetailGrid>
        <DetailRow label="Ports">
          {/* No ports on a subset means every port is exposed, which is not the same as
              "no ports" and would read as broken if left as an em dash. */}
          <Show when={(props.subset.ports ?? EMPTY).length > 0} fallback="all ports">
            <span class="tnum font-mono">
              {(props.subset.ports ?? EMPTY).map(portText).join(', ')}
            </span>
          </Show>
        </DetailRow>
        <DetailRow label="Ready">
          <AddressList addresses={props.subset.addresses} ready />
        </DetailRow>
        <DetailRow label="Not ready">
          <AddressList addresses={props.subset.notReadyAddresses} ready={false} />
        </DetailRow>
      </DetailGrid>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Descriptor                                                                 */
/* -------------------------------------------------------------------------- */

export const endpointsDescriptor = defineResource({
  id: 'endpoints',
  kind: 'Endpoints',
  title: 'Endpoints',
  group: 'network',
  icon: Share2,
  namespaced: true,

  api: {
    list: listEndpoints,
    watch: watchEndpoints,
    remove: deleteEndpoints,
    update: updateEndpoints,
  },

  status: getEndpointsStatus,

  // Addresses are searchable — "which Service is 10.244.3.17 behind?" is the question
  // that gets asked with a packet capture open. This allocates, but `searchExtra` runs
  // only while a query is active, not per sort.
  searchExtra: (endpoints: V1Endpoints) => {
    const values: (string | undefined)[] = [];
    for (const subset of endpoints.subsets ?? EMPTY) {
      for (const address of subset.addresses ?? EMPTY) {
        values.push(address.ip, address.nodeName, targetText(address));
      }
      for (const address of subset.notReadyAddresses ?? EMPTY) values.push(address.ip);
    }
    return values;
  },

  columns: [
    {
      id: 'name',
      header: 'Name',
      width: 'minmax(180px, 2.2fr)',
      value: (endpoints: V1Endpoints) => endpoints.metadata?.name,
    },
    {
      id: 'namespace',
      header: 'Namespace',
      width: 'minmax(110px, 1.2fr)',
      value: (endpoints: V1Endpoints) => endpoints.metadata?.namespace,
    },
    {
      id: 'endpoints',
      header: 'Endpoints',
      width: 'minmax(200px, 3fr)',
      // Sorted on the ready count, so ascending puts the black holes first. Sorting on
      // the rendered text would order by first octet, which nobody has ever wanted.
      value: (endpoints: V1Endpoints) => readyCount(endpoints),
      cell: (endpoints: V1Endpoints) => <EndpointsCell endpoints={endpoints} />,
    },
    {
      id: 'status',
      header: 'Status',
      width: 'minmax(110px, 1.3fr)',
      value: (endpoints: V1Endpoints) => getEndpointsStatus(endpoints).status,
      cell: (endpoints: V1Endpoints) => {
        const status = getEndpointsStatus(endpoints);
        return <StatusBadge status={status.status} variant={status.variant} size="sm" />;
      },
    },
    {
      id: 'age',
      header: 'Age',
      width: '68px',
      align: 'right',
      value: (endpoints: V1Endpoints) => ageValue(endpoints),
      cell: (endpoints: V1Endpoints) => (
        <AgeCell timestamp={endpoints.metadata?.creationTimestamp} />
      ),
    },
  ],

  detail: [
    {
      id: 'subsets',
      title: 'Subsets',
      // First, ahead of Metadata: nobody opens an Endpoints object to read its labels.
      render: (endpoints: V1Endpoints) => (
        <Show
          when={(endpoints.subsets ?? EMPTY).length > 0}
          fallback={
            <p class="text-2xs text-[var(--status-danger)]">
              No subsets. Nothing matches this Service's selector, so every request to it fails to
              connect.
            </p>
          }
        >
          <div class="flex flex-col gap-2">
            <For each={endpoints.subsets}>
              {(subset, index) => <SubsetCard subset={subset} index={index()} />}
            </For>
          </div>
        </Show>
      ),
    },
    {
      id: 'metadata',
      title: 'Metadata',
      render: (endpoints: V1Endpoints) => (
        <DetailGrid>
          <DetailRow label="Name">{endpoints.metadata?.name}</DetailRow>
          <DetailRow label="Namespace">{endpoints.metadata?.namespace}</DetailRow>
          <DetailRow label="Created">
            <AgeCell timestamp={endpoints.metadata?.creationTimestamp} /> ago
          </DetailRow>
          <DetailRow label="Ready">{readyCount(endpoints)}</DetailRow>
          <DetailRow label="Not ready">{notReadyCount(endpoints)}</DetailRow>
          <DetailRow label="Labels">
            <LabelList entries={endpoints.metadata?.labels} />
          </DetailRow>
          <DetailRow label="Annotations">
            <LabelList entries={endpoints.metadata?.annotations} />
          </DetailRow>
        </DetailGrid>
      ),
    },
  ],
});
