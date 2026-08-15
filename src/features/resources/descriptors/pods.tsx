/**
 * Pods.
 *
 * The status column is the whole reason this file is longer than the other two.
 * `kubectl get pods` does not print `status.phase`: it reconstructs a state from the
 * init-container statuses, the container statuses, the deletion timestamp and the pod
 * conditions, and that reconstruction is what people read a pod list for. The React
 * `utils/podStatus.ts` printed the bare phase, so a pod stuck in `CrashLoopBackOff`
 * showed as `Running`, an evicted pod as `Failed`, and a pod being deleted as whatever
 * it was before. `podStatusText` below is a port of kubectl's `printPod`, so this table
 * says what `kubectl` says.
 */

import { For, Show, createMemo } from 'solid-js';
import { Box } from 'lucide-solid';
import type {
  V1Container,
  V1ContainerState,
  V1OwnerReference,
  V1Pod,
  V1Volume,
} from '@kubernetes/client-node';

import { deletePods, listPods, updatePod, watchPods } from '@/api/k8s/pods';
import { LogView, Terminal } from '@/features/inspect';
import { cn } from '@/lib/k8s';
import { selectedName } from '@/stores/clusters';
import type { K8sStatus } from '@/types/k8sStatus';
import type { BadgeVariant } from '@/types/variant';
import { Badge } from '@/ui/Badge';
import { EmptyState } from '@/ui/EmptyState';
import { StatusBadge } from '@/ui/StatusBadge';
import { Tooltip } from '@/ui/Tooltip';

import {
  AgeCell,
  ConditionsTable,
  DetailGrid,
  DetailRow,
  KeyValueTable,
  LabelList,
  ageValue,
  type KeyValueEntry,
} from '../detail-parts';
import { defineResource } from '../types';

/* -------------------------------------------------------------------------- */
/* Status                                                                     */
/* -------------------------------------------------------------------------- */

/** Phases from which a pod never comes back, and which a deletion cannot override. */
const TERMINAL_PHASES = new Set(['Failed', 'Succeeded']);

/**
 * One shared empty array for the `?? []` defaults on the hot paths.
 *
 * The status, ready and restart accessors run per row per sort; allocating a throwaway
 * array in each of them is the difference between sorting 5,000 pods for free and
 * sorting them for 30,000 garbage objects.
 */
const EMPTY = [] as const;

const isTerminal = (pod: V1Pod) => TERMINAL_PHASES.has(pod.status?.phase ?? '');

const hasReadyCondition = (pod: V1Pod) => {
  for (const condition of pod.status?.conditions ?? EMPTY) {
    if (condition.type === 'Ready' && condition.status === 'True') return true;
  }
  return false;
};

/**
 * The state `kubectl get pods` prints in the STATUS column.
 *
 * Ported from `printPod` in kubectl's `printers/internalversion`. The order matters and
 * each branch earns its place:
 *
 * - `status.reason` overrides the phase, which is how `Evicted` and `NodeAffinity` are
 *   reported at all — both are `Failed` phases.
 * - Init containers are examined first and only up to the first unfinished one; while
 *   any of them is still working the regular container statuses describe containers
 *   that have not started, so reading them would report nonsense.
 * - A *restartable* init container (`restartPolicy: Always`) is a sidecar. It never
 *   terminates, so it must not be treated as a stuck init step.
 * - Regular containers are scanned backwards so the earliest failing container is the
 *   one that names the status — a pod with a crashing container and a healthy one reads
 *   as crashing, which is the point.
 * - `Completed` plus a running container means a container restarted after the last one
 *   exited; it is `Running` or `NotReady`, never `Completed`.
 */
export const podStatusText = (pod: V1Pod): string => {
  const status = pod.status;
  let reason = status?.reason || status?.phase || 'Unknown';

  // Read through optional chaining rather than `?? []`: this runs per row per sort, and
  // a fresh empty array per pod per comparison is exactly the kind of allocation the
  // column contract asks us not to make.
  const initStatuses = status?.initContainerStatuses;
  const initSpecs = pod.spec?.initContainers;
  let initializing = false;

  for (let i = 0; initStatuses && i < initStatuses.length; i += 1) {
    const container = initStatuses[i];
    if (!container) continue;

    const terminated = container.state?.terminated;
    const waiting = container.state?.waiting;

    if (terminated && terminated.exitCode === 0) continue;
    if (initSpecs?.[i]?.restartPolicy === 'Always' && container.started) continue;

    if (terminated) {
      reason = terminated.reason
        ? `Init:${terminated.reason}`
        : terminated.signal
          ? `Init:Signal:${terminated.signal}`
          : `Init:ExitCode:${terminated.exitCode}`;
    } else if (waiting?.reason && waiting.reason !== 'PodInitializing') {
      reason = `Init:${waiting.reason}`;
    } else {
      reason = `Init:${i}/${initSpecs?.length ?? 0}`;
    }

    initializing = true;
    break;
  }

  if (!initializing || isTerminal(pod)) {
    let hasRunning = false;
    const statuses = status?.containerStatuses;

    for (let i = (statuses?.length ?? 0) - 1; statuses && i >= 0; i -= 1) {
      const container = statuses[i];
      if (!container) continue;

      const waiting = container.state?.waiting;
      const terminated = container.state?.terminated;

      if (waiting?.reason) {
        reason = waiting.reason;
      } else if (terminated?.reason) {
        reason = terminated.reason;
      } else if (terminated) {
        reason = terminated.signal
          ? `Signal:${terminated.signal}`
          : `ExitCode:${terminated.exitCode}`;
      } else if (container.ready && container.state?.running) {
        hasRunning = true;
      }
    }

    if (reason === 'Completed' && hasRunning) {
      reason = hasReadyCondition(pod) ? 'Running' : 'NotReady';
    }
  }

  if (pod.metadata?.deletionTimestamp) {
    // A pod on a lost node is not being torn down by anything — the kubelet is gone.
    // Showing `Terminating` there would imply progress that is not happening.
    if (status?.reason === 'NodeLost') return 'Unknown';
    if (!isTerminal(pod)) return 'Terminating';
  }

  return reason;
};

/** Kubelet reasons that mean the pod is broken rather than merely busy. */
const FAILED_REASONS = new Set([
  'CrashLoopBackOff',
  'ImagePullBackOff',
  'ErrImagePull',
  'ErrImageNeverPull',
  'InvalidImageName',
  'ImageInspectError',
  'RegistryUnavailable',
  'CreateContainerConfigError',
  'CreateContainerError',
  'RunContainerError',
  'ContainerCannotRun',
  'PostStartHookError',
  'OOMKilled',
  'Error',
  'Evicted',
  'Failed',
  'DeadlineExceeded',
  'NodeAffinity',
  'Unschedulable',
  'NodeLost',
]);

/** Reasons that mean work is in progress. Not errors; not success either. */
const BUSY_REASONS = new Set([
  'Pending',
  'ContainerCreating',
  'PodInitializing',
  'Terminating',
  'NotReady',
  'ContainerStatusUnknown',
]);

const podStatusVariant = (status: string): BadgeVariant => {
  if (status === 'Running') return 'success';
  if (status === 'Completed' || status === 'Succeeded') return 'secondary';
  if (FAILED_REASONS.has(status)) return 'error';
  if (BUSY_REASONS.has(status)) return 'warning';

  // Synthesised statuses. The reason after the prefix is an unbounded kubelet string,
  // so the prefix is the only part that can be classified.
  if (status.startsWith('Signal:') || status.startsWith('ExitCode:')) return 'error';
  if (status.startsWith('Init:')) {
    const inner = status.slice('Init:'.length);
    if (FAILED_REASONS.has(inner) || inner.startsWith('Signal:') || inner.startsWith('ExitCode:')) {
      return 'error';
    }
    // `Init:0/2`, `Init:PodInitializing` — still working.
    return 'warning';
  }

  return 'default';
};

export const getPodStatus = (pod: V1Pod): K8sStatus => {
  const status = podStatusText(pod);
  return { status, variant: podStatusVariant(status) };
};

/* -------------------------------------------------------------------------- */
/* Containers                                                                 */
/* -------------------------------------------------------------------------- */

interface ContainerStatusInfo {
  name: string;
  ready: boolean;
  reason?: string;
  message?: string;
  state?: V1ContainerState;
}

/**
 * Reasons that make `containerStatus.ready` untrustworthy.
 *
 * Ported verbatim from `utils/containerStatus.ts`: during a crash loop the kubelet
 * keeps reporting the readiness the container had before it died, so a dot driven by
 * `ready` alone shows green for a container that is not running.
 */
const UNREADY_REASONS = new Set([
  'CrashLoopBackOff',
  'ErrImagePull',
  'ImagePullBackOff',
  'CreateContainerConfigError',
  'CreateContainerError',
  'InvalidImageName',
  'RunContainerError',
  'OOMKilled',
  'Error',
  'ContainerCannotRun',
  'DeadlineExceeded',
]);

const containerStatuses = (pod: V1Pod): ContainerStatusInfo[] =>
  (pod.status?.containerStatuses ?? []).map((container) => {
    const reason = container.state?.waiting?.reason ?? container.state?.terminated?.reason;
    const message = container.state?.waiting?.message ?? container.state?.terminated?.message;

    return {
      name: container.name,
      ready: container.ready && !(reason !== undefined && UNREADY_REASONS.has(reason)),
      reason,
      message,
      state: container.state,
    };
  });

/** Waiting reasons that are transient. Everything else waiting is either fine or fatal. */
const DOT_BUSY_REASONS = new Set([
  'ContainerCreating',
  'PodInitializing',
  'CrashLoopBackOff',
  'ImagePullBackOff',
  'ErrImagePull',
  'CreateContainerConfigError',
  'CreateContainerError',
  'ConfigError',
]);

const DOT_FAILED_REASONS = new Set([
  'Error',
  'Failed',
  'InvalidImageName',
  'ImagePullError',
  'ContainerCannotRun',
  'DeadlineExceeded',
]);

/**
 * Port of `utils/containerDotColor.ts`, with tokens instead of `bg-green-500`.
 *
 * The original was dark-mode only — `bg-white/30` for "idle" is invisible on the light
 * palette. Everything here goes through `--status-*`, so both themes work and the dot
 * hue matches the status badge beside it by construction.
 */
const dotClass = (info: ContainerStatusInfo): string => {
  const state = info.state;
  const idle = 'bg-[var(--text-tertiary)]';
  if (!state) return idle;

  if (state.waiting) {
    const reason = state.waiting.reason ?? '';
    if (DOT_FAILED_REASONS.has(reason)) return 'bg-[var(--status-danger)]';
    if (DOT_BUSY_REASONS.has(reason)) return 'bg-[var(--status-warn)]';
    return idle;
  }

  if (state.terminated) {
    return state.terminated.exitCode === 0 ? idle : 'bg-[var(--status-danger)]';
  }

  if (state.running) {
    return info.ready ? 'bg-[var(--status-ok)]' : 'bg-[var(--status-warn)]';
  }

  return idle;
};

const stateLabel = (info: ContainerStatusInfo): string => {
  const state = info.state;
  if (state?.waiting) return state.waiting.reason ?? 'Waiting';
  if (state?.terminated) {
    return state.terminated.reason ?? `Terminated (exit ${state.terminated.exitCode})`;
  }
  if (state?.running) return info.ready ? 'Running' : 'Running (not ready)';
  return 'Unknown';
};

interface ContainerDotsProps {
  pod: V1Pod;
}

/**
 * One dot per container, hued by container state.
 *
 * The React `DotContainers` mounted a tooltip **per dot**. At three containers and forty
 * visible rows that is 120 Kobalte tooltip roots, each with its own signals and presence
 * tracker, rebuilt on every scroll tick — the same cost `StatusBadge` documents avoiding.
 * There is one tooltip per row here, listing every container. The information is the
 * same; the allocation is a fortieth of it.
 */
function ContainerDots(props: ContainerDotsProps) {
  const infos = createMemo(() => containerStatuses(props.pod));

  return (
    <Show when={infos().length > 0} fallback={<span class="text-[var(--text-tertiary)]">—</span>}>
      <Tooltip
        content={
          <div class="flex flex-col gap-1">
            <For each={infos()}>
              {(info) => (
                <div class="flex items-start gap-1.5">
                  <span
                    class={cn('mt-1 size-2 shrink-0 rounded-full', dotClass(info))}
                    aria-hidden="true"
                  />
                  <div class="min-w-0">
                    <div class="font-medium text-[var(--text-primary)]">{info.name}</div>
                    <div class="text-[var(--text-secondary)]">{stateLabel(info)}</div>
                    <Show when={!info.ready && info.message}>
                      <div class="break-words text-[var(--text-tertiary)]">{info.message}</div>
                    </Show>
                  </div>
                </div>
              )}
            </For>
          </div>
        }
      >
        <span
          class="inline-flex items-center gap-1"
          aria-label={`${infos().filter((info) => info.ready).length} of ${infos().length} containers ready`}
        >
          <For each={infos()}>
            {(info) => (
              <span class={cn('size-2 shrink-0 rounded-full', dotClass(info))} aria-hidden="true" />
            )}
          </For>
        </span>
      </Tooltip>
    </Show>
  );
}

/* -------------------------------------------------------------------------- */
/* Derived values                                                             */
/* -------------------------------------------------------------------------- */

const readyCount = (pod: V1Pod): number => {
  let ready = 0;
  for (const container of pod.status?.containerStatuses ?? EMPTY) {
    if (container.ready) ready += 1;
  }
  return ready;
};

const containerCount = (pod: V1Pod): number => pod.spec?.containers?.length ?? 0;

/**
 * Restarts across every container, init containers included.
 *
 * `utils/podRestartCount.ts` summed only `containerStatuses`, so a pod whose init
 * container had restarted forty times showed zero restarts. kubectl counts both.
 */
const restartCount = (pod: V1Pod): number => {
  let restarts = 0;
  for (const container of pod.status?.containerStatuses ?? EMPTY)
    restarts += container.restartCount;
  for (const container of pod.status?.initContainerStatuses ?? EMPTY) {
    restarts += container.restartCount;
  }
  return restarts;
};

const ownerSummary = (owners?: V1OwnerReference[]): string | undefined =>
  owners?.map((owner) => `${owner.kind}/${owner.name}`).join(', ');

const quantitySummary = (quantities?: { [key: string]: string }): string | undefined => {
  const entries = Object.entries(quantities ?? {});
  if (entries.length === 0) return undefined;
  return entries.map(([key, value]) => `${key} ${value}`).join(' · ');
};

const portSummary = (container: V1Container): string | undefined => {
  const ports = container.ports ?? [];
  if (ports.length === 0) return undefined;
  return ports
    .map((port) => {
      const suffix = port.name ? ` (${port.name})` : '';
      return `${port.containerPort}/${port.protocol ?? 'TCP'}${suffix}`;
    })
    .join(', ');
};

/**
 * Environment for one container, derived exactly as `SidebarEnvSection` derived it —
 * minus the cluster round trips.
 *
 * The React version listed every ConfigMap and Secret **in the namespace** to resolve
 * `valueFrom` references, then base64-decoded every Secret it had fetched so that a pod
 * detail could print one variable. That is two extra list calls and every credential in
 * the namespace in memory, per pod opened. The reference itself is the useful part and
 * it is already in the pod spec, so that is what is shown; the value lives on the
 * Secret/ConfigMap screen, one click away.
 */
const envEntries = (container: V1Container): KeyValueEntry[] => {
  const entries: KeyValueEntry[] = [];

  for (const source of container.envFrom ?? []) {
    const prefix = source.prefix ?? '';
    if (source.configMapRef?.name) {
      entries.push({
        key: `${prefix}*`,
        hint: `all keys of configMap ${source.configMapRef.name}`,
      });
    }
    if (source.secretRef?.name) {
      entries.push({ key: `${prefix}*`, hint: `all keys of secret ${source.secretRef.name}` });
    }
  }

  for (const variable of container.env ?? []) {
    const key = variable.name;

    if (variable.value !== undefined) {
      const value = variable.value;
      entries.push({ key, value: () => value });
      continue;
    }

    const from = variable.valueFrom;
    if (from?.configMapKeyRef) {
      entries.push({
        key,
        hint: `configMap ${from.configMapKeyRef.name ?? '?'}/${from.configMapKeyRef.key}`,
      });
    } else if (from?.secretKeyRef) {
      // Not marked `secret`: there is no value here to mask, only a reference. A reveal
      // toggle over an em dash would imply the value is being withheld rather than
      // simply not fetched.
      entries.push({
        key,
        hint: `secret ${from.secretKeyRef.name ?? '?'}/${from.secretKeyRef.key}`,
      });
    } else if (from?.fieldRef) {
      entries.push({ key, hint: `field ${from.fieldRef.fieldPath}` });
    } else if (from?.resourceFieldRef) {
      entries.push({ key, hint: `resource ${from.resourceFieldRef.resource}` });
    } else {
      entries.push({ key, hint: 'no source' });
    }
  }

  return entries.sort((a, b) => a.key.localeCompare(b.key));
};

const volumeSummary = (volume: V1Volume): string => {
  if (volume.configMap?.name) return `configMap ${volume.configMap.name}`;
  if (volume.secret?.secretName) return `secret ${volume.secret.secretName}`;
  if (volume.persistentVolumeClaim) return `pvc ${volume.persistentVolumeClaim.claimName}`;
  if (volume.hostPath) return `hostPath ${volume.hostPath.path}`;
  if (volume.emptyDir) {
    return volume.emptyDir.sizeLimit ? `emptyDir (${volume.emptyDir.sizeLimit})` : 'emptyDir';
  }
  if (volume.projected) return `projected (${volume.projected.sources?.length ?? 0} sources)`;
  if (volume.downwardAPI) return 'downwardAPI';
  if (volume.csi?.driver) return `csi ${volume.csi.driver}`;

  // A volume is `{ name, <exactly one source key> }`, so the remaining key *is* the
  // type. This keeps the rarer sources (nfs, iscsi, rbd, …) readable without listing
  // all thirty of them above.
  for (const key of Object.keys(volume)) {
    if (key !== 'name') return key;
  }
  return 'unknown';
};

/* -------------------------------------------------------------------------- */
/* Detail                                                                     */
/* -------------------------------------------------------------------------- */

interface ContainerCardProps {
  pod: V1Pod;
  container: V1Container;
  init: boolean;
}

function ContainerCard(props: ContainerCardProps) {
  const info = createMemo(() =>
    containerStatuses(props.pod).find((candidate) => candidate.name === props.container.name)
  );

  return (
    <div class="rounded-sm border border-[var(--border-subtle)] bg-[var(--surface-inset)] p-2">
      <div class="mb-1.5 flex items-center gap-2">
        <Show
          when={info()}
          fallback={<span class="size-2 rounded-full bg-[var(--text-tertiary)]" />}
        >
          {(value) => <span class={cn('size-2 shrink-0 rounded-full', dotClass(value()))} />}
        </Show>
        <span class="selectable min-w-0 flex-1 truncate font-medium text-[var(--text-primary)]">
          {props.container.name}
        </span>
        <Show when={props.init}>
          <Badge variant="neutral" size="sm">
            init
          </Badge>
        </Show>
      </div>

      <DetailGrid>
        <DetailRow label="Image">{props.container.image}</DetailRow>
        <DetailRow label="State">
          <Show when={info()}>{(value) => stateLabel(value())}</Show>
        </DetailRow>
        <Show when={info()?.message}>
          <DetailRow label="Message" class="text-[var(--status-danger)]">
            {info()?.message}
          </DetailRow>
        </Show>
        <DetailRow label="Ports">{portSummary(props.container)}</DetailRow>
        <DetailRow label="Requests">
          {quantitySummary(props.container.resources?.requests)}
        </DetailRow>
        <DetailRow label="Limits">{quantitySummary(props.container.resources?.limits)}</DetailRow>
        <DetailRow label="Command">{props.container.command?.join(' ')}</DetailRow>
      </DetailGrid>

      <div class="mt-2 border-t border-[var(--border-subtle)] pt-2">
        <div class="text-2xs mb-1 text-[var(--text-tertiary)]">Environment</div>
        <KeyValueTable entries={envEntries(props.container)} empty="No environment variables" />
      </div>
    </div>
  );
}

interface PodStreamProps {
  pod: V1Pod;
}

function PodLogsTab(props: PodStreamProps) {
  return (
    <Show when={selectedName()} fallback={<EmptyState title="No cluster selected" />}>
      {(context) => (
        <LogView
          class="h-full"
          context={context()}
          namespace={props.pod.metadata?.namespace ?? ''}
          pod={props.pod.metadata?.name ?? ''}
        />
      )}
    </Show>
  );
}

function PodTerminalTab(props: PodStreamProps) {
  return (
    <Show when={selectedName()} fallback={<EmptyState title="No cluster selected" />}>
      {(context) => (
        <Terminal
          class="h-full"
          context={context()}
          namespace={props.pod.metadata?.namespace ?? ''}
          pod={props.pod.metadata?.name ?? ''}
        />
      )}
    </Show>
  );
}

/* -------------------------------------------------------------------------- */
/* Descriptor                                                                 */
/* -------------------------------------------------------------------------- */

export const podsDescriptor = defineResource({
  id: 'pods',
  kind: 'Pod',
  title: 'Pods',
  group: 'workloads',
  icon: Box,
  namespaced: true,

  api: {
    list: listPods,
    watch: watchPods,
    remove: deletePods,
    update: updatePod,
  },

  status: getPodStatus,

  searchExtra: (pod: V1Pod) => [
    pod.spec?.nodeName,
    pod.status?.podIP,
    ...Object.entries(pod.metadata?.labels ?? {}).map(([key, value]) => `${key}=${value}`),
  ],

  columns: [
    {
      id: 'name',
      header: 'Name',
      width: 'minmax(180px, 2.5fr)',
      value: (pod: V1Pod) => pod.metadata?.name,
    },
    {
      id: 'namespace',
      header: 'Namespace',
      width: 'minmax(110px, 1.2fr)',
      value: (pod: V1Pod) => pod.metadata?.namespace,
    },
    {
      id: 'containers',
      header: 'Containers',
      width: '92px',
      sortable: false,
      value: (pod: V1Pod) => pod.status?.containerStatuses?.length ?? 0,
      cell: (pod: V1Pod) => <ContainerDots pod={pod} />,
    },
    {
      id: 'ready',
      header: 'Ready',
      width: '64px',
      // Sorting by the ready *count* rather than the `n/m` string, so 2/2 does not sort
      // between 10/10 and 11/11.
      value: (pod: V1Pod) => readyCount(pod),
      cell: (pod: V1Pod) => (
        <span class="tnum">
          {readyCount(pod)}/{containerCount(pod)}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      width: 'minmax(120px, 1.5fr)',
      value: (pod: V1Pod) => podStatusText(pod),
      cell: (pod: V1Pod) => {
        const status = getPodStatus(pod);
        return <StatusBadge status={status.status} variant={status.variant} size="sm" />;
      },
    },
    {
      id: 'restarts',
      header: 'Restarts',
      width: '76px',
      align: 'right',
      value: (pod: V1Pod) => restartCount(pod),
    },
    {
      id: 'age',
      header: 'Age',
      width: '68px',
      align: 'right',
      // Wrapped rather than passed bare: every accessor in this array must take `V1Pod`
      // so `defineResource` has one inference candidate and infers `T = V1Pod`.
      value: (pod: V1Pod) => ageValue(pod),
      cell: (pod: V1Pod) => <AgeCell timestamp={pod.metadata?.creationTimestamp} />,
    },
  ],

  detail: [
    {
      id: 'metadata',
      title: 'Metadata',
      render: (pod: V1Pod) => (
        <DetailGrid>
          <DetailRow label="Name">{pod.metadata?.name}</DetailRow>
          <DetailRow label="Namespace">{pod.metadata?.namespace}</DetailRow>
          <DetailRow label="Created">
            <AgeCell timestamp={pod.metadata?.creationTimestamp} /> ago
          </DetailRow>
          <DetailRow label="Controlled by">{ownerSummary(pod.metadata?.ownerReferences)}</DetailRow>
          <DetailRow label="UID">
            <span class="text-2xs font-mono">{pod.metadata?.uid}</span>
          </DetailRow>
          <DetailRow label="Labels">
            <LabelList entries={pod.metadata?.labels} />
          </DetailRow>
          <DetailRow label="Annotations">
            <LabelList entries={pod.metadata?.annotations} />
          </DetailRow>
        </DetailGrid>
      ),
    },
    {
      id: 'runtime',
      title: 'Node & networking',
      render: (pod: V1Pod) => (
        <DetailGrid>
          <DetailRow label="Status">{podStatusText(pod)}</DetailRow>
          <DetailRow label="Phase">{pod.status?.phase}</DetailRow>
          <DetailRow label="Node">{pod.spec?.nodeName}</DetailRow>
          <DetailRow label="QoS class">{pod.status?.qosClass}</DetailRow>
          <DetailRow label="Pod IP">{pod.status?.podIP}</DetailRow>
          <DetailRow label="Host IP">{pod.status?.hostIP}</DetailRow>
          <DetailRow label="Service account">{pod.spec?.serviceAccountName}</DetailRow>
          <DetailRow label="Priority class">{pod.spec?.priorityClassName}</DetailRow>
          <DetailRow label="Restart policy">{pod.spec?.restartPolicy}</DetailRow>
          <DetailRow label="Restarts">{restartCount(pod)}</DetailRow>
        </DetailGrid>
      ),
    },
    {
      id: 'containers',
      title: 'Containers',
      render: (pod: V1Pod) => (
        <div class="flex flex-col gap-2">
          <For each={pod.spec?.initContainers}>
            {(container) => <ContainerCard pod={pod} container={container} init />}
          </For>
          <For each={pod.spec?.containers}>
            {(container) => <ContainerCard pod={pod} container={container} init={false} />}
          </For>
        </div>
      ),
    },
    {
      id: 'volumes',
      title: 'Volumes',
      collapsed: true,
      render: (pod: V1Pod) => (
        <Show
          when={(pod.spec?.volumes ?? []).length > 0}
          fallback={<span class="text-2xs text-[var(--text-tertiary)]">None</span>}
        >
          <DetailGrid>
            <For each={pod.spec?.volumes}>
              {(volume) => <DetailRow label={volume.name}>{volumeSummary(volume)}</DetailRow>}
            </For>
          </DetailGrid>
        </Show>
      ),
    },
    {
      id: 'conditions',
      title: 'Conditions',
      render: (pod: V1Pod) => <ConditionsTable conditions={pod.status?.conditions} />,
    },
  ],

  extraTabs: [
    { id: 'logs', label: 'Logs', render: (pod: V1Pod) => <PodLogsTab pod={pod} /> },
    { id: 'terminal', label: 'Terminal', render: (pod: V1Pod) => <PodTerminalTab pod={pod} /> },
  ],
});
