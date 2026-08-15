/**
 * Leases.
 *
 * A Lease is a heartbeat, and the only question worth asking of one is whether it is
 * still beating: `kube-node-lease/<node>` going stale is how the control plane decides a
 * node is gone, and a `<controller>-leader` lease going stale means nobody is running
 * that controller. `renewTime` and `leaseDurationSeconds` together answer it, and neither
 * `PaneLeases` nor `SidebarLeases` showed `renewTime` at all — the React panel listed
 * name, namespace, age and labels, which is every field except the two that matter.
 *
 * `LeaseFreshness` compares them against the one shared clock, so the badge re-evaluates
 * on the same tick as every age cell and costs no timer of its own.
 */

import { Show } from 'solid-js';
import { Timer } from 'lucide-solid';
import type { V1Lease } from '@kubernetes/client-node';

import { deleteLeases, listLeases, updateLease, watchLeases } from '@/api/k8s/leases';
import { useClock } from '@/stores/clock';
import { Badge } from '@/ui/Badge';

import { AgeCell, DetailGrid, DetailRow, LabelList, ageValue } from '../detail-parts';
import { defineResource } from '../types';

/* -------------------------------------------------------------------------- */
/* Freshness                                                                  */
/* -------------------------------------------------------------------------- */

/** Default `leaseDurationSeconds` when the holder did not set one, as kubelet uses. */
const DEFAULT_LEASE_SECONDS = 15;

const toMillis = (timestamp?: Date | string): number | undefined => {
  if (timestamp === undefined) return undefined;
  const parsed = typeof timestamp === 'string' ? Date.parse(timestamp) : timestamp.getTime();
  return Number.isNaN(parsed) ? undefined : parsed;
};

interface LeaseFreshnessProps {
  lease: V1Lease;
}

/**
 * An `expired` chip once `renewTime + leaseDurationSeconds` is in the past.
 *
 * Renders nothing while the lease is fresh: a green "ok" badge on every one of the
 * hundreds of leases a cluster holds would be pure decoration, and the absence of the
 * chip is already the good case.
 */
function LeaseFreshness(props: LeaseFreshnessProps) {
  const now = useClock();

  const expiresAt = () => {
    const renewed = toMillis(props.lease.spec?.renewTime);
    if (renewed === undefined) return undefined;
    return renewed + (props.lease.spec?.leaseDurationSeconds ?? DEFAULT_LEASE_SECONDS) * 1000;
  };

  return (
    <Show when={(expiresAt() ?? Infinity) < now()}>
      <Badge variant="danger" size="sm">
        expired
      </Badge>
    </Show>
  );
}

/* -------------------------------------------------------------------------- */
/* Descriptor                                                                 */
/* -------------------------------------------------------------------------- */

export const leasesDescriptor = defineResource({
  id: 'leases',
  kind: 'Lease',
  title: 'Leases',
  group: 'config',
  icon: Timer,
  namespaced: true,

  api: {
    list: listLeases,
    watch: watchLeases,
    remove: deleteLeases,
    update: updateLease,
  },

  searchExtra: (lease: V1Lease) => [
    lease.spec?.holderIdentity,
    ...Object.entries(lease.metadata?.labels ?? {}).map(([key, value]) => `${key}=${value}`),
  ],

  columns: [
    {
      id: 'name',
      header: 'Name',
      width: 'minmax(180px, 2.2fr)',
      value: (lease: V1Lease) => lease.metadata?.name,
    },
    {
      id: 'namespace',
      header: 'Namespace',
      width: 'minmax(110px, 1.2fr)',
      value: (lease: V1Lease) => lease.metadata?.namespace,
    },
    {
      id: 'holder',
      header: 'Holder',
      width: 'minmax(160px, 2.6fr)',
      value: (lease: V1Lease) => lease.spec?.holderIdentity,
      // A holder identity is a hostname, a pod name or a UUID and is routinely longer
      // than the column; the full value is on hover rather than wrapped over two rows.
      cell: (lease: V1Lease) => (
        <span class="truncate font-mono" title={lease.spec?.holderIdentity}>
          {lease.spec?.holderIdentity ?? '—'}
        </span>
      ),
    },
    {
      id: 'age',
      header: 'Age',
      width: '68px',
      align: 'right',
      value: (lease: V1Lease) => ageValue(lease),
      cell: (lease: V1Lease) => <AgeCell timestamp={lease.metadata?.creationTimestamp} />,
    },
  ],

  detail: [
    {
      id: 'metadata',
      title: 'Metadata',
      render: (lease: V1Lease) => (
        <DetailGrid>
          <DetailRow label="Name">{lease.metadata?.name}</DetailRow>
          <DetailRow label="Namespace">{lease.metadata?.namespace}</DetailRow>
          <DetailRow label="Created">
            <AgeCell timestamp={lease.metadata?.creationTimestamp} /> ago
          </DetailRow>
          <DetailRow label="Labels">
            <LabelList entries={lease.metadata?.labels} />
          </DetailRow>
          <DetailRow label="Annotations">
            <LabelList entries={lease.metadata?.annotations} />
          </DetailRow>
        </DetailGrid>
      ),
    },
    {
      id: 'lease',
      title: 'Lease',
      render: (lease: V1Lease) => (
        <DetailGrid>
          <DetailRow label="Holder">
            <span class="font-mono break-all">{lease.spec?.holderIdentity}</span>
          </DetailRow>
          <DetailRow label="Duration">
            <Show when={lease.spec?.leaseDurationSeconds}>
              {(seconds) => <span class="tnum">{seconds()}s</span>}
            </Show>
          </DetailRow>
          <DetailRow label="Renewed">
            <Show when={lease.spec?.renewTime}>
              {(timestamp) => (
                <span class="flex items-center gap-1.5">
                  <AgeCell timestamp={timestamp()} /> ago
                  <LeaseFreshness lease={lease} />
                </span>
              )}
            </Show>
          </DetailRow>
          <DetailRow label="Acquired">
            <Show when={lease.spec?.acquireTime}>
              {(timestamp) => (
                <>
                  <AgeCell timestamp={timestamp()} /> ago
                </>
              )}
            </Show>
          </DetailRow>
          <DetailRow label="Transitions">{lease.spec?.leaseTransitions}</DetailRow>
          <DetailRow label="Preferred holder">{lease.spec?.preferredHolder}</DetailRow>
          <DetailRow label="Strategy">{lease.spec?.strategy}</DetailRow>
        </DetailGrid>
      ),
    },
  ],
});
