/**
 * PersistentVolumes. Cluster-scoped.
 *
 * ## What the React screen got wrong
 *
 * - **`SidebarPersistentVolumes` rendered `spec` twice**, once labelled "Volume Source"
 *   and once labelled "Spec", both as raw YAML dumps of the entire spec. A PV carries
 *   exactly *one* of twenty-odd source fields — `csi`, `hostPath`, `nfs`, `local`, … — and
 *   which one it is decides everything about the volume. `volumeSource` below finds the
 *   one that is set and renders only that.
 * - **No `claim` column.** `kubectl get pv` prints CLAIM, and a released or failed PV is
 *   worthless without knowing which claim it belonged to. Nor was there a `reason`
 *   column, which is where a `Failed` PV says *why*.
 * - **Capacity sorted as text**, so `9Gi` came after `10Gi`. It sorts on bytes now.
 * - **Two `as any` casts** on `spec.capacity`, which is typed `{ [key: string]: string }`.
 *
 * `Released` gets the warning hue on purpose: the volume still holds the data of a claim
 * that no longer exists, and with `persistentVolumeReclaimPolicy: Retain` it will never be
 * reused until an administrator clears `spec.claimRef` by hand. It looks idle and is not.
 */

import { For, Show } from 'solid-js';
import { Database } from 'lucide-solid';
import type { V1PersistentVolume, V1PersistentVolumeSpec } from '@kubernetes/client-node';

import {
  deletePersistentVolumes,
  listPersistentVolumes,
  updatePersistentVolume,
  watchPersistentVolumes,
} from '@/api/k8s/persistentVolumes';
import { parseQuantity } from '@/lib/k8s';
import type { K8sStatus } from '@/types/k8sStatus';
import { StatusBadge } from '@/ui/StatusBadge';

import {
  AccessModes,
  AgeCell,
  DetailGrid,
  DetailRow,
  LabelList,
  accessModesValue,
  ageValue,
} from '../detail-parts';
import { defineResource } from '../types';

/** One shared empty array for the `?? []` defaults on the hot paths. */
const EMPTY = [] as const;

const capacity = (volume: V1PersistentVolume): string | undefined =>
  volume.spec?.capacity?.['storage'];

/** `namespace/name` of the claim that owns this volume, if any. */
const claimText = (volume: V1PersistentVolume): string | undefined => {
  const claim = volume.spec?.claimRef;
  if (!claim?.name) return undefined;
  return claim.namespace ? `${claim.namespace}/${claim.name}` : claim.name;
};

/* -------------------------------------------------------------------------- */
/* Status                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The state to show in the Status column.
 *
 * `Available` is deliberately `info` rather than `success`: an unbound volume is not
 * *wrong*, but it is also not doing anything, and colouring it the same green as a bound
 * one makes a pool of stranded volumes invisible. See the file header for `Released`.
 */
export const getPersistentVolumeStatus = (volume: V1PersistentVolume): K8sStatus => {
  const phase = volume.status?.phase;
  switch (phase) {
    case 'Bound':
      return { status: 'Bound', variant: 'success' };
    case 'Available':
      return { status: 'Available', variant: 'default' };
    case 'Released':
      return { status: 'Released', variant: 'warning' };
    case 'Failed':
      return { status: 'Failed', variant: 'error' };
    case 'Pending':
      return { status: 'Pending', variant: 'warning' };
    default:
      return { status: phase ?? 'Unknown', variant: 'default' };
  }
};

/* -------------------------------------------------------------------------- */
/* Volume source                                                              */
/* -------------------------------------------------------------------------- */

interface SourceRow {
  label: string;
  value?: string;
}

interface VolumeSource {
  /** The source field that is set, e.g. `csi`. */
  type: string;
  rows: SourceRow[];
}

/**
 * Keys of `V1PersistentVolumeSpec` that are *not* a volume source.
 *
 * Used by the fallback below: a PV spec is these fields plus exactly one source, so
 * whatever key is left over names the source. That keeps the twenty rarely-seen
 * in-tree drivers readable without a branch for each. Same trick as `volumeSummary` in
 * `pods.tsx`, and the same reason: the alternative is a list that goes stale silently.
 */
const NON_SOURCE_KEYS: ReadonlySet<string> = new Set([
  'accessModes',
  'capacity',
  'claimRef',
  'mountOptions',
  'nodeAffinity',
  'persistentVolumeReclaimPolicy',
  'storageClassName',
  'volumeAttributesClassName',
  'volumeMode',
]);

/**
 * The one source this volume actually has, with the fields worth reading off it.
 *
 * The common sources are spelled out because their interesting fields differ: a CSI
 * volume is identified by driver plus `volumeHandle`, a `local` volume by a path that
 * only exists on one node, an NFS export by server plus path. Everything else falls back
 * to naming the source type, which is still infinitely more than a dump of the whole spec
 * conveyed.
 */
const volumeSource = (spec?: V1PersistentVolumeSpec): VolumeSource | undefined => {
  if (!spec) return undefined;

  if (spec.csi) {
    return {
      type: 'csi',
      rows: [
        { label: 'Driver', value: spec.csi.driver },
        { label: 'Volume handle', value: spec.csi.volumeHandle },
        { label: 'FS type', value: spec.csi.fsType },
        { label: 'Read only', value: spec.csi.readOnly ? 'Yes' : undefined },
      ],
    };
  }

  if (spec.hostPath) {
    return {
      type: 'hostPath',
      rows: [
        { label: 'Path', value: spec.hostPath.path },
        { label: 'Type', value: spec.hostPath.type },
      ],
    };
  }

  if (spec.local) {
    return {
      type: 'local',
      rows: [
        { label: 'Path', value: spec.local.path },
        { label: 'FS type', value: spec.local.fsType },
      ],
    };
  }

  if (spec.nfs) {
    return {
      type: 'nfs',
      rows: [
        { label: 'Server', value: spec.nfs.server },
        { label: 'Path', value: spec.nfs.path },
        { label: 'Read only', value: spec.nfs.readOnly ? 'Yes' : undefined },
      ],
    };
  }

  if (spec.iscsi) {
    return {
      type: 'iscsi',
      rows: [
        { label: 'Portal', value: spec.iscsi.targetPortal },
        { label: 'IQN', value: spec.iscsi.iqn },
        { label: 'LUN', value: String(spec.iscsi.lun) },
      ],
    };
  }

  if (spec.cephfs) {
    return {
      type: 'cephfs',
      rows: [
        { label: 'Monitors', value: spec.cephfs.monitors.join(', ') },
        { label: 'Path', value: spec.cephfs.path },
        { label: 'User', value: spec.cephfs.user },
      ],
    };
  }

  if (spec.rbd) {
    return {
      type: 'rbd',
      rows: [
        { label: 'Monitors', value: spec.rbd.monitors.join(', ') },
        { label: 'Pool', value: spec.rbd.pool },
        { label: 'Image', value: spec.rbd.image },
      ],
    };
  }

  if (spec.glusterfs) {
    return {
      type: 'glusterfs',
      rows: [
        { label: 'Endpoints', value: spec.glusterfs.endpoints },
        { label: 'Path', value: spec.glusterfs.path },
      ],
    };
  }

  if (spec.awsElasticBlockStore) {
    return {
      type: 'awsElasticBlockStore',
      rows: [
        { label: 'Volume ID', value: spec.awsElasticBlockStore.volumeID },
        { label: 'FS type', value: spec.awsElasticBlockStore.fsType },
      ],
    };
  }

  if (spec.gcePersistentDisk) {
    return {
      type: 'gcePersistentDisk',
      rows: [
        { label: 'PD name', value: spec.gcePersistentDisk.pdName },
        { label: 'FS type', value: spec.gcePersistentDisk.fsType },
      ],
    };
  }

  if (spec.azureDisk) {
    return {
      type: 'azureDisk',
      rows: [
        { label: 'Disk name', value: spec.azureDisk.diskName },
        { label: 'URI', value: spec.azureDisk.diskURI },
      ],
    };
  }

  if (spec.azureFile) {
    return {
      type: 'azureFile',
      rows: [
        { label: 'Share', value: spec.azureFile.shareName },
        { label: 'Secret', value: spec.azureFile.secretName },
      ],
    };
  }

  if (spec.vsphereVolume) {
    return {
      type: 'vsphereVolume',
      rows: [
        { label: 'Volume path', value: spec.vsphereVolume.volumePath },
        { label: 'FS type', value: spec.vsphereVolume.fsType },
      ],
    };
  }

  for (const key of Object.keys(spec)) {
    if (!NON_SOURCE_KEYS.has(key)) return { type: key, rows: [] };
  }

  return undefined;
};

/**
 * `spec.nodeAffinity.required` as text, one line per term.
 *
 * This is what pins a `local` volume to a single node, and therefore what makes a pod
 * using it unschedulable everywhere else. `SidebarPersistentVolumes` dumped it as YAML.
 */
const nodeAffinityTerms = (volume: V1PersistentVolume): string[] => {
  const terms: string[] = [];
  for (const term of volume.spec?.nodeAffinity?.required?.nodeSelectorTerms ?? EMPTY) {
    for (const expression of term.matchExpressions ?? EMPTY) {
      terms.push(
        `${expression.key} ${expression.operator} ${(expression.values ?? EMPTY).join(',')}`.trim()
      );
    }
    for (const field of term.matchFields ?? EMPTY) {
      terms.push(`${field.key} ${field.operator} ${(field.values ?? EMPTY).join(',')}`.trim());
    }
  }
  return terms;
};

/* -------------------------------------------------------------------------- */
/* Descriptor                                                                 */
/* -------------------------------------------------------------------------- */

export const persistentVolumesDescriptor = defineResource({
  id: 'persistentVolumes',
  kind: 'PersistentVolume',
  title: 'Persistent Volumes',
  group: 'storage',
  icon: Database,
  namespaced: false,

  // Cluster-scoped: `list_persistent_volumes` and `delete_persistent_volumes` take no
  // namespace, so these accept `{ name }` and `{ name, resourceNames }`.
  api: {
    list: listPersistentVolumes,
    watch: watchPersistentVolumes,
    remove: deletePersistentVolumes,
    update: updatePersistentVolume,
  },

  status: getPersistentVolumeStatus,

  // The claim is the searchable part: people arrive here from a PVC name, and dynamically
  // provisioned volumes are named `pvc-<uuid>`, which nobody can search for.
  searchExtra: (volume: V1PersistentVolume) => [
    claimText(volume),
    volume.spec?.storageClassName,
    volumeSource(volume.spec)?.type,
    ...Object.entries(volume.metadata?.labels ?? {}).map(([key, value]) => `${key}=${value}`),
  ],

  columns: [
    {
      id: 'name',
      header: 'Name',
      width: 'minmax(180px, 2.2fr)',
      value: (volume: V1PersistentVolume) => volume.metadata?.name,
      cell: (volume: V1PersistentVolume) => (
        <span class="truncate font-mono" title={volume.metadata?.name}>
          {volume.metadata?.name}
        </span>
      ),
    },
    {
      id: 'capacity',
      header: 'Capacity',
      width: '92px',
      align: 'right',
      // Bytes, not `10Gi`. See the note on the PVC capacity column.
      value: (volume: V1PersistentVolume) => parseQuantity(capacity(volume)),
      cell: (volume: V1PersistentVolume) => <span class="tnum">{capacity(volume) ?? '—'}</span>,
    },
    {
      id: 'accessModes',
      header: 'Access modes',
      width: '112px',
      value: (volume: V1PersistentVolume) => accessModesValue(volume.spec?.accessModes),
      cell: (volume: V1PersistentVolume) => <AccessModes modes={volume.spec?.accessModes} />,
    },
    {
      id: 'reclaimPolicy',
      header: 'Reclaim',
      width: '92px',
      value: (volume: V1PersistentVolume) => volume.spec?.persistentVolumeReclaimPolicy,
    },
    {
      id: 'status',
      header: 'Status',
      width: 'minmax(100px, 1.2fr)',
      value: (volume: V1PersistentVolume) => getPersistentVolumeStatus(volume).status,
      cell: (volume: V1PersistentVolume) => {
        const status = getPersistentVolumeStatus(volume);
        return <StatusBadge status={status.status} variant={status.variant} size="sm" />;
      },
    },
    {
      id: 'claim',
      header: 'Claim',
      width: 'minmax(140px, 2fr)',
      value: (volume: V1PersistentVolume) => claimText(volume),
      cell: (volume: V1PersistentVolume) => (
        <span class="truncate" title={claimText(volume)}>
          {claimText(volume)}
        </span>
      ),
    },
    {
      id: 'storageClass',
      header: 'Storage class',
      width: 'minmax(110px, 1.4fr)',
      value: (volume: V1PersistentVolume) => volume.spec?.storageClassName,
    },
    {
      id: 'reason',
      header: 'Reason',
      width: 'minmax(100px, 1.4fr)',
      // Only ever set on a `Failed` volume, and then it is the whole explanation.
      value: (volume: V1PersistentVolume) => volume.status?.reason,
      cell: (volume: V1PersistentVolume) => (
        <span class="truncate text-[var(--status-danger)]" title={volume.status?.reason}>
          {volume.status?.reason}
        </span>
      ),
    },
    {
      id: 'age',
      header: 'Age',
      width: '68px',
      align: 'right',
      value: (volume: V1PersistentVolume) => ageValue(volume),
      cell: (volume: V1PersistentVolume) => (
        <AgeCell timestamp={volume.metadata?.creationTimestamp} />
      ),
    },
  ],

  detail: [
    {
      id: 'source',
      title: 'Volume source',
      // First: which driver holds the data is the one thing a PV is opened to learn.
      render: (volume: V1PersistentVolume) => (
        <Show
          when={volumeSource(volume.spec)}
          fallback={
            <p class="text-2xs text-[var(--text-tertiary)]">
              No volume source is set on this object.
            </p>
          }
        >
          {(source) => (
            <div class="flex flex-col gap-1.5">
              <span class="selectable font-medium text-[var(--code-key)]">{source().type}</span>
              <Show
                when={source().rows.length > 0}
                fallback={
                  <span class="text-2xs text-[var(--text-tertiary)]">
                    No further detail is shown for this source type — see the YAML tab.
                  </span>
                }
              >
                <DetailGrid>
                  <For each={source().rows}>
                    {(row) => (
                      <DetailRow label={row.label}>
                        <span class="text-2xs font-mono break-all">{row.value}</span>
                      </DetailRow>
                    )}
                  </For>
                </DetailGrid>
              </Show>
            </div>
          )}
        </Show>
      ),
    },
    {
      id: 'binding',
      title: 'Capacity & binding',
      render: (volume: V1PersistentVolume) => (
        <DetailGrid>
          <DetailRow label="Status">{getPersistentVolumeStatus(volume).status}</DetailRow>
          <DetailRow label="Reason" class="text-[var(--status-danger)]">
            {volume.status?.reason}
          </DetailRow>
          <DetailRow label="Message" class="text-[var(--status-danger)]">
            {volume.status?.message}
          </DetailRow>
          <DetailRow label="Capacity">{capacity(volume)}</DetailRow>
          <DetailRow label="Access modes">
            <AccessModes modes={volume.spec?.accessModes} />
          </DetailRow>
          <DetailRow label="Volume mode">{volume.spec?.volumeMode ?? 'Filesystem'}</DetailRow>
          {/* `Delete` destroys the backing storage when the claim goes; `Retain` keeps it
              and leaves the volume `Released` until an admin intervenes. Nothing about a
              PV is more consequential. */}
          <DetailRow label="Reclaim policy">{volume.spec?.persistentVolumeReclaimPolicy}</DetailRow>
          <DetailRow label="Storage class">{volume.spec?.storageClassName}</DetailRow>
          <DetailRow label="Claim">{claimText(volume)}</DetailRow>
          <DetailRow label="Mount options">
            {/* Passed straight to `mount(8)`; a bad option fails the mount at pod start
                with an error that never mentions the PV. */}
            <Show when={(volume.spec?.mountOptions ?? EMPTY).length > 0}>
              <span class="text-2xs font-mono break-all">
                {(volume.spec?.mountOptions ?? EMPTY).join(', ')}
              </span>
            </Show>
          </DetailRow>
        </DetailGrid>
      ),
    },
    {
      id: 'nodeAffinity',
      title: 'Node affinity',
      render: (volume: V1PersistentVolume) => (
        <Show
          when={nodeAffinityTerms(volume).length > 0}
          fallback={
            <p class="text-2xs text-[var(--text-tertiary)]">
              None — a pod using this volume can be scheduled on any node.
            </p>
          }
        >
          <div class="flex flex-col gap-0.5">
            <For each={nodeAffinityTerms(volume)}>
              {(term) => <span class="selectable text-2xs font-mono break-all">{term}</span>}
            </For>
          </div>
        </Show>
      ),
    },
    {
      id: 'metadata',
      title: 'Metadata',
      render: (volume: V1PersistentVolume) => (
        <DetailGrid>
          <DetailRow label="Name">{volume.metadata?.name}</DetailRow>
          <DetailRow label="Created">
            <AgeCell timestamp={volume.metadata?.creationTimestamp} /> ago
          </DetailRow>
          <DetailRow label="Labels">
            <LabelList entries={volume.metadata?.labels} />
          </DetailRow>
          <DetailRow label="Annotations">
            <LabelList entries={volume.metadata?.annotations} />
          </DetailRow>
        </DetailGrid>
      ),
    },
  ],
});
