/**
 * Nodes. Cluster-scoped.
 *
 * This is the screen someone opens when a cluster is in trouble, so it carries more than
 * the rest of its group.
 *
 * ## What the React screen got wrong
 *
 * - **`utils/nodeStatus.ts` ignored `spec.unschedulable` entirely.** A cordoned node — the
 *   most common reason a pod will not schedule anywhere — showed a green `Ready`,
 *   indistinguishable from a node that is actually taking work. `kubectl get nodes` prints
 *   `Ready,SchedulingDisabled`, and the comma matters: the node is both things at once.
 *   `nodeStatusText` below is a port of kubectl's `printNode`.
 * - **`Ready: Unknown` was reported as `Unknown`.** kubectl prints `NotReady`, and it is
 *   right to: a kubelet that has stopped heartbeating is not running your pods whatever the
 *   reason. The distinction survives in the Conditions section, which is where a reader can
 *   act on it.
 * - **Roles missed `kubernetes.io/role`.** kubectl's `findNodeRoles` reads that label *and*
 *   the `node-role.kubernetes.io/*` prefix; clusters provisioned by kops and by older
 *   installers set only the former, so their control-plane nodes showed no role at all.
 * - **Addresses, capacity, allocatable, taints and conditions were five raw YAML dumps.**
 *   Capacity against allocatable is a *comparison*: the gap is what the kubelet has held
 *   back for the system and the kernel, and it is the number that explains why a node
 *   advertising 8 CPUs will not admit a pod asking for 8. It is rendered as a comparison
 *   here, with the reserved fraction worked out through `parseQuantity` — `8` and `7900m`
 *   cannot be subtracted as text.
 *
 * There is no `create_node` or `update_node` command — a node is registered by its kubelet,
 * not by us — so `api` carries no `update` and the YAML tab is correctly read-only.
 */

import { For, Show, createMemo } from 'solid-js';
import { Server } from 'lucide-solid';
import type { V1Node, V1Taint } from '@kubernetes/client-node';

import { deleteNodes, listNodes, watchNodes } from '@/api/k8s/nodes';
import { parseQuantity } from '@/lib/k8s';
import type { K8sStatus } from '@/types/k8sStatus';
import { Badge, type StatusVariant } from '@/ui/Badge';
import { StatusBadge } from '@/ui/StatusBadge';

import {
  AgeCell,
  ConditionsTable,
  DetailGrid,
  DetailRow,
  LabelList,
  ageValue,
} from '../detail-parts';
import { defineResource } from '../types';

/**
 * One shared empty array for the `?? []` defaults on the hot paths.
 *
 * Column accessors run per row per sort; a throwaway array in each of them is the
 * difference between sorting a list for free and sorting it for a heap of garbage. Same
 * reasoning as `pods.tsx`.
 */
const EMPTY = [] as const;

/* -------------------------------------------------------------------------- */
/* Status                                                                     */
/* -------------------------------------------------------------------------- */

const READY = 'Ready';
const NOT_READY = 'NotReady';
const UNKNOWN = 'Unknown';

/**
 * The `Ready` condition reduced the way kubectl reduces it.
 *
 * Anything that is not literally `True` is `NotReady` — `Unknown` included. See the file
 * header for why that is the honest answer rather than a lossy one.
 */
const readyText = (node: V1Node): string => {
  for (const condition of node.status?.conditions ?? EMPTY) {
    if (condition.type === READY) return condition.status === 'True' ? READY : NOT_READY;
  }
  // A node that reports no conditions at all has never been contacted; kubectl prints
  // `Unknown` for it, and that is a different thing from a stale `Ready: Unknown`.
  return UNKNOWN;
};

/**
 * The STATUS column of `kubectl get nodes`.
 *
 * The comma-joined form is deliberate and load-bearing: `Ready,SchedulingDisabled` is a
 * node that is healthy *and* cordoned, and collapsing that to either half alone loses the
 * fact somebody needs. Only cordoned nodes allocate a string here, which is a small
 * minority of any list.
 */
export const nodeStatusText = (node: V1Node): string => {
  const ready = readyText(node);
  return node.spec?.unschedulable ? `${ready},SchedulingDisabled` : ready;
};

export const getNodeStatus = (node: V1Node): K8sStatus => {
  const ready = readyText(node);
  const status = node.spec?.unschedulable ? `${ready},SchedulingDisabled` : ready;

  // A cordoned but healthy node is amber, not green: it is deliberately not accepting
  // work, and a page of green nodes that cannot take a pod is the exact confusion the
  // React screen produced.
  if (ready === READY) return { status, variant: node.spec?.unschedulable ? 'warning' : 'success' };
  if (ready === UNKNOWN) return { status, variant: 'warning' };
  return { status, variant: 'error' };
};

/* -------------------------------------------------------------------------- */
/* Roles                                                                      */
/* -------------------------------------------------------------------------- */

const ROLE_PREFIX = 'node-role.kubernetes.io/';
const ROLE_LABEL = 'kubernetes.io/role';

/** kubectl's own placeholder. A worker node genuinely has no role label. */
const NO_ROLES = '<none>';

/**
 * The ROLES column, ported from kubectl's `findNodeRoles`.
 *
 * Both label conventions are read, and the result is sorted and de-duplicated because a
 * node can carry `node-role.kubernetes.io/master` *and* `kubernetes.io/role: master`.
 * This allocates, which a column accessor should not — but node lists are hundreds of
 * rows at the very top end, never the thousands that made the pod accessors matter, and
 * the alternative (sorting on an arbitrary first label) is not an order anyone could
 * infer from the cell.
 */
const nodeRoles = (node: V1Node): string => {
  const labels = node.metadata?.labels;
  if (!labels) return NO_ROLES;

  const roles: string[] = [];
  for (const key in labels) {
    let role: string | undefined;
    if (key.startsWith(ROLE_PREFIX)) role = key.slice(ROLE_PREFIX.length);
    else if (key === ROLE_LABEL) role = labels[key];

    if (role && !roles.includes(role)) roles.push(role);
  }

  return roles.length === 0 ? NO_ROLES : roles.sort().join(',');
};

/* -------------------------------------------------------------------------- */
/* Addresses and system info                                                  */
/* -------------------------------------------------------------------------- */

const addressOf = (node: V1Node, type: string): string | undefined => {
  for (const address of node.status?.addresses ?? EMPTY) {
    if (address.type === type) return address.address;
  }
  return undefined;
};

const internalIP = (node: V1Node): string | undefined => addressOf(node, 'InternalIP');
const externalIP = (node: V1Node): string | undefined => addressOf(node, 'ExternalIP');

/** `linux/amd64`. The pair, because an image built for the wrong half of it will not run. */
const osArch = (node: V1Node): string | undefined => {
  const info = node.status?.nodeInfo;
  if (!info) return undefined;
  return `${info.operatingSystem}/${info.architecture}`;
};

/* -------------------------------------------------------------------------- */
/* Capacity vs allocatable                                                    */
/* -------------------------------------------------------------------------- */

/** The order `kubectl describe node` prints. Everything else follows, alphabetically. */
const RESOURCE_ORDER = ['cpu', 'memory', 'ephemeral-storage', 'pods'];

const orderIndex = (resource: string): number => {
  const index = RESOURCE_ORDER.indexOf(resource);
  return index < 0 ? RESOURCE_ORDER.length : index;
};

interface CapacityRow {
  resource: string;
  capacity?: string;
  allocatable?: string;
  /** `(capacity - allocatable) / capacity`, or `undefined` when either side will not parse. */
  reserved?: number;
}

/**
 * Capacity beside allocatable, one row per resource.
 *
 * The two maps are unioned rather than iterated from `capacity` alone: a device plugin
 * that has stopped reporting leaves an entry in one and not the other, and a resource
 * that silently vanishes from the table is precisely the kind of thing this screen exists
 * to show. Both sides go through `parseQuantity` because `8` and `7900m` are the same
 * resource in two notations and cannot be compared as text.
 */
const capacityRows = (node: V1Node): CapacityRow[] => {
  const capacity = node.status?.capacity;
  const allocatable = node.status?.allocatable;

  const names = new Set<string>();
  for (const key in capacity) names.add(key);
  for (const key in allocatable) names.add(key);

  const rows: CapacityRow[] = [];
  for (const resource of names) {
    const capacityText = capacity?.[resource];
    const allocatableText = allocatable?.[resource];

    const capacityNumber = parseQuantity(capacityText);
    const allocatableNumber = parseQuantity(allocatableText);

    // Clamped at zero: allocatable is never meant to exceed capacity, but a
    // misconfigured `--system-reserved` has produced negative reservations before and a
    // "-4%" cell reads as a rendering bug rather than as the misconfiguration it is.
    const reserved =
      capacityNumber !== undefined && allocatableNumber !== undefined && capacityNumber > 0
        ? Math.max(0, (capacityNumber - allocatableNumber) / capacityNumber)
        : undefined;

    rows.push({ resource, capacity: capacityText, allocatable: allocatableText, reserved });
  }

  return rows.sort(
    (a, b) =>
      orderIndex(a.resource) - orderIndex(b.resource) || a.resource.localeCompare(b.resource)
  );
};

const CAPACITY_GRID = 'grid grid-cols-[minmax(0,1fr)_76px_76px_48px] items-baseline gap-2';

interface CapacityTableProps {
  node: V1Node;
}

/** Allocatable against capacity, with the kubelet's reservation as a percentage. */
function CapacityTable(props: CapacityTableProps) {
  const rows = createMemo(() => capacityRows(props.node));

  return (
    <Show
      when={rows().length > 0}
      fallback={
        <span class="text-2xs text-[var(--text-tertiary)]">
          This node has not reported its capacity.
        </span>
      }
    >
      <div class="flex flex-col divide-y divide-[var(--border-subtle)]">
        <div class={`text-2xs ${CAPACITY_GRID} pb-1 text-[var(--text-tertiary)]`}>
          <span>Resource</span>
          <span class="text-right">Allocatable</span>
          <span class="text-right">Capacity</span>
          <span class="text-right">Reserved</span>
        </div>

        <For each={rows()}>
          {(row) => (
            <div class={`${CAPACITY_GRID} py-1`}>
              <span
                class="selectable text-2xs truncate font-mono text-[var(--code-key)]"
                title={row.resource}
              >
                {row.resource}
              </span>
              <span class="selectable tnum text-2xs text-right text-[var(--text-primary)]">
                {row.allocatable ?? '—'}
              </span>
              <span class="selectable tnum text-2xs text-right text-[var(--text-secondary)]">
                {row.capacity ?? '—'}
              </span>
              <span class="tnum text-2xs text-right text-[var(--text-tertiary)]">
                {/* Compared against `undefined`, not tested for truthiness: a node that
                    reserves nothing is 0% and must not read as "unknown". */}
                <Show when={row.reserved !== undefined} fallback="—">
                  {Math.round((row.reserved ?? 0) * 100)}%
                </Show>
              </span>
            </div>
          )}
        </For>
      </div>
    </Show>
  );
}

/* -------------------------------------------------------------------------- */
/* Taints                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Hue per effect, by blast radius.
 *
 * `NoExecute` does not merely stop new pods: it *evicts* the ones already running that do
 * not tolerate it, which is why it is the only red one.
 */
const TAINT_VARIANT: Record<string, StatusVariant> = {
  NoSchedule: 'warn',
  NoExecute: 'danger',
  PreferNoSchedule: 'neutral',
};

/** `key=value`, or a bare `key` — a valueless taint is legal and common. */
const taintText = (taint: V1Taint): string =>
  taint.value ? `${taint.key}=${taint.value}` : taint.key;

interface TaintListProps {
  node: V1Node;
}

function TaintList(props: TaintListProps) {
  return (
    <Show
      when={(props.node.spec?.taints ?? EMPTY).length > 0}
      fallback={
        <span class="text-2xs text-[var(--text-tertiary)]">
          None — any pod may be scheduled here.
        </span>
      }
    >
      <div class="flex flex-col divide-y divide-[var(--border-subtle)]">
        <For each={props.node.spec?.taints}>
          {(taint) => (
            <div class="flex items-baseline gap-2 py-1">
              <span class="selectable text-2xs min-w-0 flex-1 font-mono break-all text-[var(--text-primary)]">
                {taintText(taint)}
              </span>
              <Badge variant={TAINT_VARIANT[taint.effect] ?? 'neutral'} size="sm">
                {taint.effect}
              </Badge>
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

export const nodesDescriptor = defineResource({
  id: 'nodes',
  kind: 'Node',
  title: 'Nodes',
  group: 'cluster',
  icon: Server,
  namespaced: false,

  // Cluster-scoped: `list_nodes` takes `{ name }` and `delete_nodes`
  // `{ name, resourceNames }`. There is deliberately no `update` — see the file header.
  api: {
    list: listNodes,
    watch: watchNodes,
    remove: deleteNodes,
  },

  status: getNodeStatus,

  // The IP and the kubelet version are what people paste in from an alert; the labels are
  // how a node pool is found, since pool membership is only ever expressed as a label.
  searchExtra: (node: V1Node) => [
    internalIP(node),
    externalIP(node),
    node.status?.nodeInfo?.kubeletVersion,
    node.status?.nodeInfo?.osImage,
    nodeRoles(node),
    ...Object.entries(node.metadata?.labels ?? {}).map(([key, value]) => `${key}=${value}`),
  ],

  columns: [
    {
      id: 'name',
      header: 'Name',
      width: 'minmax(180px, 2.4fr)',
      value: (node: V1Node) => node.metadata?.name,
    },
    {
      id: 'status',
      header: 'Status',
      width: 'minmax(130px, 1.6fr)',
      value: (node: V1Node) => nodeStatusText(node),
      cell: (node: V1Node) => {
        const status = getNodeStatus(node);
        return <StatusBadge status={status.status} variant={status.variant} size="sm" />;
      },
    },
    {
      id: 'roles',
      header: 'Roles',
      width: 'minmax(100px, 1.3fr)',
      value: (node: V1Node) => nodeRoles(node),
      cell: (node: V1Node) => {
        const roles = nodeRoles(node);
        return (
          <span
            class={roles === NO_ROLES ? 'truncate text-[var(--text-tertiary)]' : 'truncate'}
            title={roles}
          >
            {roles}
          </span>
        );
      },
    },
    {
      id: 'version',
      header: 'Version',
      width: '96px',
      value: (node: V1Node) => node.status?.nodeInfo?.kubeletVersion,
    },
    {
      id: 'internalIP',
      header: 'Internal IP',
      width: 'minmax(110px, 1.3fr)',
      value: (node: V1Node) => internalIP(node),
      cell: (node: V1Node) => <span class="truncate font-mono">{internalIP(node)}</span>,
    },
    {
      id: 'externalIP',
      header: 'External IP',
      width: 'minmax(110px, 1.3fr)',
      // Off by default: it is empty on every on-premises and most managed clusters, and a
      // permanently blank column is worse than one column fewer.
      optional: true,
      value: (node: V1Node) => externalIP(node),
      cell: (node: V1Node) => <span class="truncate font-mono">{externalIP(node)}</span>,
    },
    {
      id: 'osArch',
      header: 'OS/Arch',
      width: 'minmax(96px, 1.2fr)',
      value: (node: V1Node) => osArch(node),
    },
    {
      id: 'age',
      header: 'Age',
      width: '68px',
      align: 'right',
      value: (node: V1Node) => ageValue(node),
      cell: (node: V1Node) => <AgeCell timestamp={node.metadata?.creationTimestamp} />,
    },
  ],

  detail: [
    {
      id: 'scheduling',
      title: 'Status & scheduling',
      // First section: whether this node is taking work is the question that brought
      // anyone here.
      render: (node: V1Node) => (
        <DetailGrid>
          <DetailRow label="Status">{nodeStatusText(node)}</DetailRow>
          <DetailRow label="Schedulable">
            <Show when={node.spec?.unschedulable} fallback="Yes">
              <span class="text-[var(--status-warn)]">
                No — cordoned. Nothing new will be scheduled here until it is uncordoned; pods
                already running are left alone.
              </span>
            </Show>
          </DetailRow>
          <DetailRow label="Roles">{nodeRoles(node)}</DetailRow>
          <DetailRow label="Kubelet">{node.status?.nodeInfo?.kubeletVersion}</DetailRow>
          <DetailRow label="Internal IP">
            <span class="font-mono">{internalIP(node)}</span>
          </DetailRow>
          <DetailRow label="External IP">
            <span class="font-mono">{externalIP(node)}</span>
          </DetailRow>
          <DetailRow label="Pod CIDRs">
            {/* `podCIDRs` is the dual-stack form and `podCIDR` its first entry. */}
            <span class="font-mono">
              {(node.spec?.podCIDRs ?? EMPTY).join(', ') || node.spec?.podCIDR}
            </span>
          </DetailRow>
          <DetailRow label="Provider ID">
            <span class="text-2xs font-mono break-all">{node.spec?.providerID}</span>
          </DetailRow>
          <DetailRow label="Created">
            <AgeCell timestamp={node.metadata?.creationTimestamp} /> ago
          </DetailRow>
        </DetailGrid>
      ),
    },
    {
      id: 'conditions',
      title: 'Conditions',
      // Second: `MemoryPressure`, `DiskPressure` and `PIDPressure` invert — `True` is bad —
      // and `ConditionsTable` already knows that, so they are coloured correctly here.
      render: (node: V1Node) => <ConditionsTable conditions={node.status?.conditions} />,
    },
    {
      id: 'capacity',
      title: 'Capacity & allocatable',
      render: (node: V1Node) => <CapacityTable node={node} />,
    },
    {
      id: 'taints',
      title: 'Taints',
      render: (node: V1Node) => <TaintList node={node} />,
    },
    {
      id: 'addresses',
      title: 'Addresses',
      collapsed: true,
      render: (node: V1Node) => (
        <Show
          when={(node.status?.addresses ?? EMPTY).length > 0}
          fallback={<span class="text-2xs text-[var(--text-tertiary)]">None reported</span>}
        >
          <DetailGrid>
            <For each={node.status?.addresses}>
              {(address) => (
                <DetailRow label={address.type}>
                  <span class="font-mono break-all">{address.address}</span>
                </DetailRow>
              )}
            </For>
          </DetailGrid>
        </Show>
      ),
    },
    {
      id: 'nodeInfo',
      title: 'System info',
      collapsed: true,
      render: (node: V1Node) => (
        <DetailGrid>
          <DetailRow label="OS image">{node.status?.nodeInfo?.osImage}</DetailRow>
          <DetailRow label="Kernel">{node.status?.nodeInfo?.kernelVersion}</DetailRow>
          <DetailRow label="Runtime">{node.status?.nodeInfo?.containerRuntimeVersion}</DetailRow>
          <DetailRow label="Kubelet">{node.status?.nodeInfo?.kubeletVersion}</DetailRow>
          {/* Reported by the kubelet and, since 1.31, deprecated and often simply wrong —
              shown because a mismatch here is still the first sign of a half-finished
              upgrade, not because the value can be trusted on its own. */}
          <DetailRow label="Kube-proxy">{node.status?.nodeInfo?.kubeProxyVersion}</DetailRow>
          <DetailRow label="Architecture">{node.status?.nodeInfo?.architecture}</DetailRow>
          <DetailRow label="Operating system">{node.status?.nodeInfo?.operatingSystem}</DetailRow>
          <DetailRow label="Machine ID">
            <span class="text-2xs font-mono break-all">{node.status?.nodeInfo?.machineID}</span>
          </DetailRow>
        </DetailGrid>
      ),
    },
    {
      id: 'metadata',
      title: 'Metadata',
      collapsed: true,
      // Collapsed because a node carries thirty-odd topology and instance-type labels that
      // would otherwise push the conditions off the screen.
      render: (node: V1Node) => (
        <DetailGrid>
          <DetailRow label="Name">{node.metadata?.name}</DetailRow>
          <DetailRow label="UID">
            <span class="text-2xs font-mono">{node.metadata?.uid}</span>
          </DetailRow>
          <DetailRow label="Labels">
            <LabelList entries={node.metadata?.labels} />
          </DetailRow>
          <DetailRow label="Annotations">
            <LabelList entries={node.metadata?.annotations} />
          </DetailRow>
        </DetailGrid>
      ),
    },
  ],
});
