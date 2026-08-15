/**
 * PersistentVolumeClaims.
 *
 * ## What the React screen got wrong
 *
 * - **`Released` was a dead branch.** `getPvcStatus` mapped `Released` to `warning`, but
 *   `Released` is a *PersistentVolume* phase; a PVC is only ever `Pending`, `Bound` or
 *   `Lost`. The branch could never run, and its presence hid the state that really is
 *   missing: a PVC with a `deletionTimestamp` that will not go away, because the
 *   `kubernetes.io/pvc-protection` finalizer holds it while a pod still mounts it. That is
 *   the single most common "I deleted it and nothing happened" on this kind, and it is
 *   `Terminating` below.
 * - **Capacity sorted as text**, so `9Gi` came after `10Gi` and `500Mi` after `2Gi`. The
 *   column sorts on bytes now, via `parseQuantity`.
 * - **Two needless `as any` casts.** `pvc.status?.capacity` is typed
 *   `{ [key: string]: string }`; `(pvc.status?.capacity as any)?.storage` weakened it for
 *   nothing, in both the pane and the sidebar.
 * - **The volume was missing from the table.** `kubectl get pvc` prints it, and it is the
 *   only link from a claim to the PV that actually holds the data.
 *
 * The detail panel puts the requested size next to the actual one, because they differ
 * exactly while an expansion is in flight — and an expansion that never completes leaves
 * them differing forever with nothing else to show for it.
 */

import { Show } from 'solid-js';
import { HardDrive } from 'lucide-solid';
import type { V1PersistentVolumeClaim } from '@kubernetes/client-node';

import {
  deletePersistentVolumeClaims,
  listPersistentVolumeClaims,
  updatePersistentVolumeClaim,
  watchPersistentVolumeClaims,
} from '@/api/k8s/persistentVolumeClaims';
import { parseQuantity } from '@/lib/k8s';
import type { K8sStatus } from '@/types/k8sStatus';
import { StatusBadge } from '@/ui/StatusBadge';

import {
  AccessModes,
  AgeCell,
  ConditionsTable,
  DetailGrid,
  DetailRow,
  LabelList,
  accessModesValue,
  ageValue,
} from '../detail-parts';
import { defineResource } from '../types';

/* -------------------------------------------------------------------------- */
/* Capacity                                                                   */
/* -------------------------------------------------------------------------- */

/** What the claim asked for. Never changes except when someone edits the claim. */
const requestedStorage = (claim: V1PersistentVolumeClaim): string | undefined =>
  claim.spec?.resources?.requests?.['storage'];

/** What the bound volume actually provides. Absent until the claim binds. */
const actualStorage = (claim: V1PersistentVolumeClaim): string | undefined =>
  claim.status?.capacity?.['storage'];

/**
 * True while the volume is smaller than the claim asks for.
 *
 * A provisioner may also hand out *more* than was requested (rounding to its own block
 * size), which is not an expansion and must not be flagged as one — hence the strict
 * comparison in one direction only.
 */
const isExpanding = (claim: V1PersistentVolumeClaim): boolean => {
  const requested = parseQuantity(requestedStorage(claim));
  const actual = parseQuantity(actualStorage(claim));
  if (requested === undefined || actual === undefined) return false;
  return actual < requested;
};

/* -------------------------------------------------------------------------- */
/* Status                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * The state to show in the Status column.
 *
 * `Pending` is amber rather than red because it is the normal state of a claim whose
 * StorageClass binds `WaitForFirstConsumer`: it stays pending, correctly, until a pod
 * that uses it is scheduled. `Lost` is red — the PV backing the claim is gone and the
 * data with it.
 *
 * Plain field reads; no allocation.
 */
export const getPersistentVolumeClaimStatus = (claim: V1PersistentVolumeClaim): K8sStatus => {
  // Checked before the phase: a terminating claim keeps reporting `Bound`, so the phase
  // alone says the object is healthy right up until it disappears — or, when a pod still
  // mounts it, forever.
  if (claim.metadata?.deletionTimestamp) return { status: 'Terminating', variant: 'warning' };

  const phase = claim.status?.phase;
  switch (phase) {
    case 'Bound':
      return isExpanding(claim)
        ? { status: 'Expanding', variant: 'warning' }
        : { status: 'Bound', variant: 'success' };
    case 'Pending':
      return { status: 'Pending', variant: 'warning' };
    case 'Lost':
      return { status: 'Lost', variant: 'error' };
    default:
      return { status: phase ?? 'Unknown', variant: 'default' };
  }
};

/* -------------------------------------------------------------------------- */
/* Descriptor                                                                 */
/* -------------------------------------------------------------------------- */

export const persistentVolumeClaimsDescriptor = defineResource({
  id: 'persistentVolumeClaims',
  kind: 'PersistentVolumeClaim',
  title: 'Persistent Volume Claims',
  group: 'storage',
  icon: HardDrive,
  namespaced: true,

  api: {
    list: listPersistentVolumeClaims,
    watch: watchPersistentVolumeClaims,
    remove: deletePersistentVolumeClaims,
    update: updatePersistentVolumeClaim,
  },

  status: getPersistentVolumeClaimStatus,

  searchExtra: (claim: V1PersistentVolumeClaim) => [
    claim.spec?.volumeName,
    claim.spec?.storageClassName,
    ...Object.entries(claim.metadata?.labels ?? {}).map(([key, value]) => `${key}=${value}`),
  ],

  columns: [
    {
      id: 'name',
      header: 'Name',
      width: 'minmax(180px, 2.2fr)',
      value: (claim: V1PersistentVolumeClaim) => claim.metadata?.name,
    },
    {
      id: 'namespace',
      header: 'Namespace',
      width: 'minmax(110px, 1.2fr)',
      value: (claim: V1PersistentVolumeClaim) => claim.metadata?.namespace,
    },
    {
      id: 'status',
      header: 'Status',
      width: 'minmax(100px, 1.2fr)',
      value: (claim: V1PersistentVolumeClaim) => getPersistentVolumeClaimStatus(claim).status,
      cell: (claim: V1PersistentVolumeClaim) => {
        const status = getPersistentVolumeClaimStatus(claim);
        return <StatusBadge status={status.status} variant={status.variant} size="sm" />;
      },
    },
    {
      id: 'volume',
      header: 'Volume',
      width: 'minmax(140px, 2fr)',
      value: (claim: V1PersistentVolumeClaim) => claim.spec?.volumeName,
      cell: (claim: V1PersistentVolumeClaim) => (
        <span class="truncate font-mono" title={claim.spec?.volumeName}>
          {claim.spec?.volumeName}
        </span>
      ),
    },
    {
      id: 'capacity',
      header: 'Capacity',
      width: '92px',
      align: 'right',
      // Sorted on **bytes**, not on `10Gi`: as text `10Gi` sorts before `9Gi`, and `2Gi`
      // before `500Mi`. The cell still shows the string the apiserver sent.
      value: (claim: V1PersistentVolumeClaim) => parseQuantity(actualStorage(claim)),
      cell: (claim: V1PersistentVolumeClaim) => (
        <span class="tnum">{actualStorage(claim) ?? '—'}</span>
      ),
    },
    {
      id: 'accessModes',
      header: 'Access modes',
      width: '112px',
      value: (claim: V1PersistentVolumeClaim) => accessModesValue(claim.spec?.accessModes),
      cell: (claim: V1PersistentVolumeClaim) => <AccessModes modes={claim.spec?.accessModes} />,
    },
    {
      id: 'storageClass',
      header: 'Storage class',
      width: 'minmax(110px, 1.4fr)',
      value: (claim: V1PersistentVolumeClaim) => claim.spec?.storageClassName,
    },
    {
      id: 'age',
      header: 'Age',
      width: '68px',
      align: 'right',
      value: (claim: V1PersistentVolumeClaim) => ageValue(claim),
      cell: (claim: V1PersistentVolumeClaim) => (
        <AgeCell timestamp={claim.metadata?.creationTimestamp} />
      ),
    },
  ],

  detail: [
    {
      id: 'storage',
      title: 'Storage',
      // First: this is the object. Metadata is below.
      render: (claim: V1PersistentVolumeClaim) => (
        <DetailGrid>
          <DetailRow label="Status">{getPersistentVolumeClaimStatus(claim).status}</DetailRow>
          <DetailRow label="Phase">{claim.status?.phase}</DetailRow>
          <DetailRow label="Requested">{requestedStorage(claim)}</DetailRow>
          <DetailRow
            label="Actual"
            class={isExpanding(claim) ? 'text-[var(--status-warn)]' : undefined}
          >
            {/* Shown next to the request because the two differ exactly while an
                expansion is in flight — and an expansion blocked on a provisioner that
                cannot resize leaves them differing with nothing else to show for it. */}
            {actualStorage(claim)}
          </DetailRow>
          <DetailRow label="Volume">
            <span class="font-mono">{claim.spec?.volumeName}</span>
          </DetailRow>
          <DetailRow label="Storage class">{claim.spec?.storageClassName}</DetailRow>
          {/* `Block` hands the raw device to the container with no filesystem on it, so a
              pod expecting a mount path silently gets something it cannot read. The API
              default is `Filesystem`. */}
          <DetailRow label="Volume mode">{claim.spec?.volumeMode ?? 'Filesystem'}</DetailRow>
          <DetailRow label="Access modes">
            <AccessModes modes={claim.spec?.accessModes} />
          </DetailRow>
          <DetailRow label="Attributes class">{claim.spec?.volumeAttributesClassName}</DetailRow>
          <DetailRow label="Data source">
            {/* A claim cloned from a snapshot or another PVC. Worth seeing: it explains
                why a "new" volume already has data in it. */}
            <Show when={claim.spec?.dataSource}>
              {(source) => (
                <span class="font-mono">
                  {source().kind}/{source().name}
                </span>
              )}
            </Show>
          </DetailRow>
        </DetailGrid>
      ),
    },
    {
      id: 'metadata',
      title: 'Metadata',
      render: (claim: V1PersistentVolumeClaim) => (
        <DetailGrid>
          <DetailRow label="Name">{claim.metadata?.name}</DetailRow>
          <DetailRow label="Namespace">{claim.metadata?.namespace}</DetailRow>
          <DetailRow label="Created">
            <AgeCell timestamp={claim.metadata?.creationTimestamp} /> ago
          </DetailRow>
          <DetailRow label="Deleted">
            {/* Present and stuck means a finalizer is holding the claim — almost always
                `kubernetes.io/pvc-protection`, i.e. a pod is still using it. */}
            <Show when={claim.metadata?.deletionTimestamp}>
              {(timestamp) => (
                <>
                  <AgeCell timestamp={timestamp()} /> ago
                </>
              )}
            </Show>
          </DetailRow>
          <DetailRow label="Selector">
            <LabelList entries={claim.spec?.selector?.matchLabels} empty="—" />
          </DetailRow>
          <DetailRow label="Labels">
            <LabelList entries={claim.metadata?.labels} />
          </DetailRow>
          <DetailRow label="Annotations">
            <LabelList entries={claim.metadata?.annotations} />
          </DetailRow>
        </DetailGrid>
      ),
    },
    {
      id: 'conditions',
      title: 'Conditions',
      // `Resizing` and `FileSystemResizePending` live here and are the only explanation
      // for a claim whose actual capacity is stuck below its request.
      render: (claim: V1PersistentVolumeClaim) => (
        <ConditionsTable conditions={claim.status?.conditions} />
      ),
    },
  ],
});
