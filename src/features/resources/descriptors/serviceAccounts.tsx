/**
 * ServiceAccounts.
 *
 * The one thing this screen has to get across is that **an empty Secrets column is normal
 * now**. Since Kubernetes 1.24 the token controller no longer mints a Secret per service
 * account — pods get a projected, audience-scoped, expiring token instead — so `secrets`
 * is empty for almost every account on a modern cluster. `SidebarServiceAccounts` printed
 * the bare count with no explanation, which reads as "this account is broken" to anyone
 * who last looked at a 1.23 cluster. The detail says so in words.
 *
 * `automountServiceAccountToken` is the other field worth reading, and the React screen
 * did not show it at all: unset means *true*, so an account someone believes is inert is
 * still handing a token to every pod that uses it.
 */

import { For, Show } from 'solid-js';
import { UserCog } from 'lucide-solid';
import type { V1ServiceAccount } from '@kubernetes/client-node';

import {
  deleteServiceAccounts,
  listServiceAccounts,
  updateServiceAccount,
  watchServiceAccounts,
} from '@/api/k8s/serviceAccounts';

import { AgeCell, DetailGrid, DetailRow, LabelList, ageValue } from '../detail-parts';
import { defineResource } from '../types';

/** One shared empty array for the `?? []` defaults on the hot paths. */
const EMPTY = [] as const;

const secretCount = (account: V1ServiceAccount): number => account.secrets?.length ?? 0;

/**
 * `automountServiceAccountToken` in words.
 *
 * The tri-state matters: `undefined` is not "off", it is "on, by omission". A pod can
 * still override it either way, which is why the wording says what the *account* asks for
 * rather than what will happen.
 */
const automountText = (account: V1ServiceAccount): string => {
  if (account.automountServiceAccountToken === true) return 'Yes, explicitly';
  if (account.automountServiceAccountToken === false) return 'No';
  return 'Not set — a token is mounted, which is the default';
};

interface ReferenceListProps {
  /** `secrets` or `imagePullSecrets`; both are references with an optional name. */
  names: readonly string[];
  empty: string;
}

function ReferenceList(props: ReferenceListProps) {
  return (
    <Show
      when={props.names.length > 0}
      fallback={<span class="text-2xs text-[var(--text-tertiary)]">{props.empty}</span>}
    >
      <div class="flex flex-col gap-0.5">
        <For each={props.names}>
          {(name) => (
            <span class="selectable text-2xs font-mono break-all text-[var(--text-primary)]">
              {name}
            </span>
          )}
        </For>
      </div>
    </Show>
  );
}

/** `V1ObjectReference.name` and `V1LocalObjectReference.name` are both optional. */
const referenceNames = (references?: readonly { name?: string }[]): string[] => {
  const names: string[] = [];
  for (const reference of references ?? EMPTY) {
    if (reference.name) names.push(reference.name);
  }
  return names;
};

/* -------------------------------------------------------------------------- */
/* Descriptor                                                                 */
/* -------------------------------------------------------------------------- */

export const serviceAccountsDescriptor = defineResource({
  id: 'serviceAccounts',
  kind: 'ServiceAccount',
  title: 'Service Accounts',
  group: 'access',
  icon: UserCog,
  namespaced: true,

  api: {
    list: listServiceAccounts,
    watch: watchServiceAccounts,
    remove: deleteServiceAccounts,
    update: updateServiceAccount,
  },

  // The pull secret is the searchable part: "which accounts still reference the registry
  // credential we rotated?" is the question that brings anyone to this list in bulk.
  searchExtra: (account: V1ServiceAccount) => [
    ...referenceNames(account.secrets),
    ...referenceNames(account.imagePullSecrets),
    ...Object.entries(account.metadata?.labels ?? {}).map(([key, value]) => `${key}=${value}`),
  ],

  columns: [
    {
      id: 'name',
      header: 'Name',
      width: 'minmax(180px, 2.6fr)',
      value: (account: V1ServiceAccount) => account.metadata?.name,
    },
    {
      id: 'namespace',
      header: 'Namespace',
      width: 'minmax(110px, 1.2fr)',
      value: (account: V1ServiceAccount) => account.metadata?.namespace,
    },
    {
      id: 'secrets',
      header: 'Secrets',
      width: '72px',
      align: 'right',
      // The number, not the string: `10` must not sort between `1` and `2`.
      value: (account: V1ServiceAccount) => secretCount(account),
      cell: (account: V1ServiceAccount) => <span class="tnum">{secretCount(account)}</span>,
    },
    {
      id: 'age',
      header: 'Age',
      width: '68px',
      align: 'right',
      value: (account: V1ServiceAccount) => ageValue(account),
      cell: (account: V1ServiceAccount) => (
        <AgeCell timestamp={account.metadata?.creationTimestamp} />
      ),
    },
  ],

  detail: [
    {
      id: 'tokens',
      title: 'Tokens & secrets',
      render: (account: V1ServiceAccount) => (
        <DetailGrid>
          <DetailRow label="Automount">{automountText(account)}</DetailRow>
          <DetailRow label="Secrets">
            <ReferenceList
              names={referenceNames(account.secrets)}
              empty="None. Since Kubernetes 1.24 tokens are projected into the pod rather than stored in a Secret, so this is expected."
            />
          </DetailRow>
          <DetailRow label="Image pull secrets">
            {/* Silently ignored if the named Secret does not exist in this namespace: the
                pull just fails later with `ImagePullBackOff` and never mentions the
                account. Worth reading before blaming the registry. */}
            <ReferenceList names={referenceNames(account.imagePullSecrets)} empty="None" />
          </DetailRow>
        </DetailGrid>
      ),
    },
    {
      id: 'metadata',
      title: 'Metadata',
      render: (account: V1ServiceAccount) => (
        <DetailGrid>
          <DetailRow label="Name">{account.metadata?.name}</DetailRow>
          <DetailRow label="Namespace">{account.metadata?.namespace}</DetailRow>
          <DetailRow label="Created">
            <AgeCell timestamp={account.metadata?.creationTimestamp} /> ago
          </DetailRow>
          <DetailRow label="UID">
            <span class="text-2xs font-mono">{account.metadata?.uid}</span>
          </DetailRow>
          <DetailRow label="Labels">
            <LabelList entries={account.metadata?.labels} />
          </DetailRow>
          <DetailRow label="Annotations">
            {/* Cloud IAM bindings — `eks.amazonaws.com/role-arn`,
                `iam.gke.io/gcp-service-account` — live here, so this row is often the most
                consequential thing on the screen. */}
            <LabelList entries={account.metadata?.annotations} />
          </DetailRow>
        </DetailGrid>
      ),
    },
  ],
});
