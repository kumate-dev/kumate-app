/**
 * Secrets.
 *
 * ## The one rule
 *
 * A Secret value is never rendered until someone asks for it, one key at a time. The
 * table shows how many keys there are and nothing else; the detail panel shows dots.
 * `KeyValueTable` takes each value as a *thunk*, so the base64 is not even decoded
 * until the reveal toggle is pressed — a screenshot, a screen share or a DOM dump of
 * this panel contains no credentials.
 *
 * The React `SidebarSecrets` did the opposite: it decoded every key into a
 * `useKeyValueEditor` on mount, so opening a Secret put every value in the DOM, and an
 * `useAutoSaveOnOutsideClick` hook then wrote them back to the cluster if you clicked
 * away. Neither behaviour is ported.
 *
 * A key *can* be edited here, but only the one key, and only after it has been
 * revealed: the editor is seeded from the same thunk the reveal toggle uses, so nothing
 * is decoded that the user did not ask to see. Writes go through `stringData` — see
 * `dataEditing`.
 *
 * The YAML tab still shows `data` as the apiserver stores it, i.e. base64, which is
 * exactly what `kubectl get secret -o yaml` does and is the only way editing can work.
 * Base64 is not encryption and is not treated as such anywhere here.
 */

import { Show } from 'solid-js';
import { KeyRound } from 'lucide-solid';
import type { V1Secret } from '@kubernetes/client-node';

import {
  deleteSecrets,
  listSecrets,
  patchSecret,
  updateSecret,
  watchSecrets,
} from '@/api/k8s/secrets';
import { selectedName } from '@/stores/clusters';
import type { K8sStatus } from '@/types/k8sStatus';
import { StatusBadge } from '@/ui/StatusBadge';
import { toast } from '@/ui/Toast';
import { decodeBase64, isBinaryBase64 } from '@/utils/base64';

import {
  AgeCell,
  DetailGrid,
  DetailRow,
  KeyValueTable,
  LabelList,
  ageValue,
  type KeyValueEditing,
  type KeyValueEntry,
} from '../detail-parts';
import { defineResource } from '../types';

/**
 * Port of `utils/secretTypeStatus.ts`, hue mapping included.
 *
 * KNOWN ISSUE: the hue here encodes the *kind* of Secret, not its health, so a
 * perfectly healthy `kubernetes.io/tls` Secret renders in the danger colour and a
 * registry pull Secret renders green. That contradicts the status palette, where red
 * means "this is broken" (see `index.css`). Fix: drop the switch, render every type as
 * `neutral`, and let the type text carry the distinction — but do it once, in a change
 * that also updates the other 30-odd `*Status.ts` ports, rather than making this one
 * kind inconsistent with the rest of the app.
 */
export const getSecretTypeStatus = (secret: V1Secret): K8sStatus => {
  const type = secret.type ?? 'Unknown';

  switch (type) {
    case 'Opaque':
      return { status: type, variant: 'secondary' };
    case 'kubernetes.io/service-account-token':
      return { status: type, variant: 'warning' };
    case 'kubernetes.io/dockerconfigjson':
      return { status: type, variant: 'success' };
    case 'kubernetes.io/tls':
      return { status: type, variant: 'error' };
    default:
      return { status: type, variant: 'default' };
  }
};

/**
 * Number of keys, without allocating.
 *
 * `Object.keys(...).length` builds a throwaway array, and this is a column accessor —
 * it runs for every row on every sort and every keystroke in the search box.
 */
const countKeys = (record?: { [key: string]: string }): number => {
  if (!record) return 0;
  let count = 0;
  for (const key in record) {
    if (Object.hasOwn(record, key)) count += 1;
  }
  return count;
};

const keyCount = (secret: V1Secret): number =>
  countKeys(secret.data) + countKeys(secret.stringData);

/** Decoded size, computed from the base64 length so nothing has to be decoded. */
const decodedByteLength = (encoded: string): number => {
  if (encoded.length === 0) return 0;
  const padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((encoded.length * 3) / 4) - padding);
};

const dataEntries = (secret: V1Secret): KeyValueEntry[] => {
  const entries: KeyValueEntry[] = [];

  for (const [key, encoded] of Object.entries(secret.data ?? {})) {
    entries.push({
      key,
      // A thunk: `decodeBase64` runs on reveal, on copy or when the editor for this one
      // key opens — never on render.
      value: () => decodeBase64(encoded),
      hint: `${decodedByteLength(encoded)} bytes`,
      secret: true,
      // Also a thunk, and for the same reason: deciding whether these bytes are text
      // means decoding them, which must not happen before the user reveals the key. A
      // Secret holding a PKCS#12 bundle or a gzipped blob is read-only here, because
      // retyping it as UTF-8 would replace the bytes with mojibake.
      binary: () => isBinaryBase64(encoded),
    });
  }

  // `stringData` is write-only on the apiserver and normally absent on a read, but a
  // manifest applied locally can still carry it — and it is plaintext, so it must be
  // masked at least as hard as `data`.
  for (const [key, value] of Object.entries(secret.stringData ?? {})) {
    entries.push({
      key,
      value: () => value,
      hint: `stringData · ${value.length} bytes`,
      secret: true,
    });
  }

  return entries.sort((a, b) => a.key.localeCompare(b.key));
};

/* -------------------------------------------------------------------------- */
/* Editing                                                                    */
/* -------------------------------------------------------------------------- */

/** One JSON merge patch against one Secret. */
const patchData = async (secret: V1Secret, patch: Record<string, unknown>) => {
  const cluster = selectedName();
  if (!cluster) throw new Error('No cluster is selected.');

  const resourceName = secret.metadata?.name;
  if (!resourceName) throw new Error('This Secret has no name.');

  await patchSecret({
    name: cluster,
    namespace: secret.metadata?.namespace,
    resourceName,
    patch,
  });
};

/**
 * The write half of the Data section.
 *
 * Writes go to **`stringData`**, which is write-only: the apiserver base64-encodes it
 * into `data` itself. That is the whole reason this is safe to offer. Encoding client
 * side would mean the plaintext takes a round trip through our own base64 helpers on
 * the way out as well as on the way in, and every bug in that path corrupts a
 * credential silently — the failure mode is a pod that cannot authenticate, hours
 * later, with nothing in the diff to look at.
 *
 * Deletion clears the key from **both** maps. `data` is where a persisted key actually
 * lives, because the apiserver folds `stringData` in and drops it. But an object that
 * was applied locally and not yet reconciled can still carry an unpersisted
 * `stringData` key, and a patch naming only `data` would remove nothing while returning
 * 200 — a silent no-op reported to the user as success. Naming a key that does not exist
 * in a merge patch is harmless, so clearing both is the only version that is correct in
 * both states.
 *
 * Nothing is echoed back. The toasts name the key — key names are already in the table
 * and in `searchExtra` — and never the value.
 */
const dataEditing = (secret: V1Secret): KeyValueEditing => ({
  onSave: async (key, value) => {
    await patchData(secret, { stringData: { [key]: value } });
    toast.success(`Updated ${key}`);
  },
  onAdd: async (key, value) => {
    await patchData(secret, { stringData: { [key]: value } });
    toast.success(`Added ${key}`);
  },
  onDelete: async (key) => {
    await patchData(secret, { data: { [key]: null }, stringData: { [key]: null } });
    toast.success(`Removed ${key}`);
  },
  subject: `Secret ${secret.metadata?.name ?? ''}`.trim(),
});

export const secretsDescriptor = defineResource({
  id: 'secrets',
  kind: 'Secret',
  title: 'Secrets',
  group: 'config',
  icon: KeyRound,
  namespaced: true,

  api: {
    list: listSecrets,
    watch: watchSecrets,
    remove: deleteSecrets,
    update: updateSecret,
    patch: patchSecret,
  },

  status: getSecretTypeStatus,

  // Key *names* are not sensitive and are how people find a Secret ("which one has
  // tls.crt?"). Values are never searched, and never leave `dataEntries`.
  searchExtra: (secret: V1Secret) => [
    secret.type,
    ...Object.keys(secret.data ?? {}),
    ...Object.entries(secret.metadata?.labels ?? {}).map(([key, value]) => `${key}=${value}`),
  ],

  columns: [
    {
      id: 'name',
      header: 'Name',
      width: 'minmax(180px, 2.5fr)',
      value: (secret: V1Secret) => secret.metadata?.name,
    },
    {
      id: 'namespace',
      header: 'Namespace',
      width: 'minmax(110px, 1.2fr)',
      value: (secret: V1Secret) => secret.metadata?.namespace,
    },
    {
      id: 'type',
      header: 'Type',
      width: 'minmax(140px, 2fr)',
      value: (secret: V1Secret) => secret.type,
      cell: (secret: V1Secret) => {
        const status = getSecretTypeStatus(secret);
        return <StatusBadge status={status.status} variant={status.variant} size="sm" />;
      },
    },
    {
      id: 'keys',
      header: 'Keys',
      width: '60px',
      align: 'right',
      value: (secret: V1Secret) => keyCount(secret),
    },
    {
      id: 'age',
      header: 'Age',
      width: '68px',
      align: 'right',
      value: (secret: V1Secret) => ageValue(secret),
      cell: (secret: V1Secret) => <AgeCell timestamp={secret.metadata?.creationTimestamp} />,
    },
  ],

  detail: [
    {
      id: 'metadata',
      title: 'Metadata',
      render: (secret: V1Secret) => (
        <DetailGrid>
          <DetailRow label="Name">{secret.metadata?.name}</DetailRow>
          <DetailRow label="Namespace">{secret.metadata?.namespace}</DetailRow>
          <DetailRow label="Type">
            <StatusBadge
              status={getSecretTypeStatus(secret).status}
              variant={getSecretTypeStatus(secret).variant}
              size="sm"
              maxWidth={240}
            />
          </DetailRow>
          <DetailRow label="Created">
            <AgeCell timestamp={secret.metadata?.creationTimestamp} /> ago
          </DetailRow>
          <DetailRow label="Immutable">{secret.immutable ? 'Yes' : 'No'}</DetailRow>
          <DetailRow label="Keys">{keyCount(secret)}</DetailRow>
          <DetailRow label="Labels">
            <LabelList entries={secret.metadata?.labels} />
          </DetailRow>
          <DetailRow label="Annotations">
            <LabelList entries={secret.metadata?.annotations} />
          </DetailRow>
        </DetailGrid>
      ),
    },
    {
      id: 'data',
      title: 'Data',
      render: (secret: V1Secret) => (
        <div class="flex flex-col gap-1.5">
          <p class="text-2xs text-[var(--text-tertiary)]">
            Values are hidden. Reveal, copy or edit one key at a time.
          </p>

          {/* `immutable` is enforced by the apiserver: every write to `data` on such a
              Secret is rejected, so offering the controls would only produce a 422. */}
          <Show when={secret.immutable}>
            <p class="text-2xs text-[var(--text-tertiary)]">
              This Secret is immutable. Its data cannot be changed — recreate it, or delete it and
              apply a new one.
            </p>
          </Show>

          <KeyValueTable
            entries={dataEntries(secret)}
            empty="This Secret has no data"
            copyable
            editing={secret.immutable ? undefined : dataEditing(secret)}
          />
        </div>
      ),
    },
  ],
});
