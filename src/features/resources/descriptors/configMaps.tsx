/**
 * ConfigMaps.
 *
 * The sibling of `secrets.tsx`, and deliberately its opposite: a ConfigMap value is not
 * credential material, so nothing is masked, nothing is base64 and every value is
 * rendered and copyable immediately. What the two files share is the shape of the panel,
 * which is the point of `KeyValueTable` taking a thunk — here the thunk simply returns
 * the string it was given.
 *
 * Two behaviours of the React original are not ported:
 *
 * - `PaneConfigMaps` rendered a **red dot** in the Keys column for a ConfigMap with no
 *   `data`. An empty ConfigMap is legal, common (it is how you reserve a name for a
 *   later `kubectl create --from-file`) and not an error; red means broken everywhere
 *   else in this app. The column is a count now, and an empty one reads `0`.
 * - `SidebarConfigMaps` loaded every key into a `useKeyValueEditor` and wired
 *   `useAutoSaveOnOutsideClick` to it, so clicking away from the panel wrote the
 *   ConfigMap back to the cluster. A key is edited here one at a time, explicitly, and
 *   each save is a merge patch naming that one key — see `dataEditing`.
 */

import { Show } from 'solid-js';
import { FileText } from 'lucide-solid';
import type { V1ConfigMap } from '@kubernetes/client-node';

import {
  deleteConfigMaps,
  listConfigMaps,
  patchConfigMap,
  updateConfigMap,
  watchConfigMaps,
} from '@/api/k8s/configMaps';
import { selectedName } from '@/stores/clusters';
import { toast } from '@/ui/Toast';

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

/* -------------------------------------------------------------------------- */
/* Derived values                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Number of keys, without allocating.
 *
 * Same reasoning as the copy in `secrets.tsx`: `Object.keys(...).length` builds a
 * throwaway array, and this is a column accessor — it runs for every row on every sort
 * and on every keystroke in the search box.
 */
const countKeys = (record?: { [key: string]: string }): number => {
  if (!record) return 0;
  let count = 0;
  for (const key in record) {
    if (Object.hasOwn(record, key)) count += 1;
  }
  return count;
};

const keyCount = (configMap: V1ConfigMap): number =>
  countKeys(configMap.data) + countKeys(configMap.binaryData);

/** Decoded size of a base64 payload, computed from its length so nothing is decoded. */
const decodedByteLength = (encoded: string): number => {
  if (encoded.length === 0) return 0;
  const padding = encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((encoded.length * 3) / 4) - padding);
};

/** Line count without splitting the string, which for a 500-line file matters. */
const countLines = (value: string): number => {
  let lines = 1;
  for (let i = 0; i < value.length; i += 1) {
    if (value.charCodeAt(i) === 10) lines += 1;
  }
  return lines;
};

/**
 * Shape hint shown under each value.
 *
 * A ConfigMap key is usually a whole file — `nginx.conf`, `application.yaml`,
 * `entrypoint.sh` — so "how big is this" is the first thing anyone wants to know, and
 * for a multi-line value the line count says it better than a byte count.
 */
const describeValue = (value: string): string => {
  const lines = countLines(value);
  return lines > 1 ? `${lines} lines · ${value.length} chars` : `${value.length} chars`;
};

const dataEntries = (configMap: V1ConfigMap): KeyValueEntry[] => {
  const entries: KeyValueEntry[] = [];

  for (const [key, value] of Object.entries(configMap.data ?? {})) {
    entries.push({ key, value: () => value, hint: describeValue(value) });
  }

  // `binaryData` is base64-encoded arbitrary bytes: a TLS trust store, a `.jar`, a
  // font. Decoding it would put mojibake in the DOM and offer a copy button that
  // produces a corrupt file, so the key and its size are listed and the value is left
  // undefined — `KeyValueTable` renders an em dash and disables copy for it. The bytes
  // are still in the YAML tab, exactly as the apiserver stores them.
  for (const [key, encoded] of Object.entries(configMap.binaryData ?? {})) {
    entries.push({
      key,
      hint: `binary · ${decodedByteLength(encoded)} bytes`,
      // Constant rather than a decode: `binaryData` is bytes by definition. It is still
      // a thunk because `KeyValueEntry` needs it to be one for Secrets, where answering
      // the question means decoding a value that may not have been revealed yet.
      binary: () => true,
    });
  }

  return entries.sort((a, b) => a.key.localeCompare(b.key));
};

/* -------------------------------------------------------------------------- */
/* Editing                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * One JSON merge patch against one ConfigMap.
 *
 * `data` is a map, so add, edit and delete are the same request: naming a key sets it,
 * and `null` removes it. Nothing local is touched afterwards — the watch delivers the
 * `MODIFIED` event and `createResourceList` reconciles the row in place, which is both
 * less code and the only version that is still correct when someone else edits the
 * object at the same time.
 */
const patchField = async (
  configMap: V1ConfigMap,
  field: 'data' | 'binaryData',
  entries: Record<string, string | null>
) => {
  const cluster = selectedName();
  if (!cluster) throw new Error('No cluster is selected.');

  const resourceName = configMap.metadata?.name;
  if (!resourceName) throw new Error('This ConfigMap has no name.');

  await patchConfigMap({
    name: cluster,
    namespace: configMap.metadata?.namespace,
    resourceName,
    patch: { [field]: entries },
  });
};

/**
 * The write half of the Data section.
 *
 * `binaryData` values are bytes and are not editable as text — the table marks them
 * read-only off the `binary` thunk. Deleting one is still fine, which is why the delete
 * path looks up which of the two maps the key actually lives in: a merge patch has to
 * name the right one, and `data: { key: null }` against a `binaryData` key removes
 * nothing while reporting success.
 */
const dataEditing = (configMap: V1ConfigMap): KeyValueEditing => ({
  onSave: async (key, value) => {
    await patchField(configMap, 'data', { [key]: value });
    toast.success(`Updated ${key}`);
  },
  onAdd: async (key, value) => {
    await patchField(configMap, 'data', { [key]: value });
    toast.success(`Added ${key}`);
  },
  onDelete: async (key) => {
    const field = Object.hasOwn(configMap.binaryData ?? {}, key) ? 'binaryData' : 'data';
    await patchField(configMap, field, { [key]: null });
    toast.success(`Removed ${key}`);
  },
  subject: `ConfigMap ${configMap.metadata?.name ?? ''}`.trim(),
});

/* -------------------------------------------------------------------------- */
/* Descriptor                                                                 */
/* -------------------------------------------------------------------------- */

export const configMapsDescriptor = defineResource({
  id: 'configMaps',
  kind: 'ConfigMap',
  title: 'ConfigMaps',
  group: 'config',
  icon: FileText,
  namespaced: true,

  api: {
    list: listConfigMaps,
    watch: watchConfigMaps,
    remove: deleteConfigMaps,
    update: updateConfigMap,
    patch: patchConfigMap,
  },

  // Key names are how people find a ConfigMap ("which one holds nginx.conf?"). Values
  // are not searched: they are whole files, and matching a query against every byte of
  // every ConfigMap in the namespace on each keystroke is not a search, it is a grep.
  searchExtra: (configMap: V1ConfigMap) => [
    ...Object.keys(configMap.data ?? {}),
    ...Object.keys(configMap.binaryData ?? {}),
    ...Object.entries(configMap.metadata?.labels ?? {}).map(([key, value]) => `${key}=${value}`),
  ],

  columns: [
    {
      id: 'name',
      header: 'Name',
      width: 'minmax(180px, 2.5fr)',
      value: (configMap: V1ConfigMap) => configMap.metadata?.name,
    },
    {
      id: 'namespace',
      header: 'Namespace',
      width: 'minmax(110px, 1.2fr)',
      value: (configMap: V1ConfigMap) => configMap.metadata?.namespace,
    },
    {
      id: 'keys',
      header: 'Keys',
      width: '60px',
      align: 'right',
      // A count, not the joined key names the React column showed: those sorted
      // lexically, so a ConfigMap with `a` sorted before one with 30 keys starting `b`.
      value: (configMap: V1ConfigMap) => keyCount(configMap),
    },
    {
      id: 'age',
      header: 'Age',
      width: '68px',
      align: 'right',
      value: (configMap: V1ConfigMap) => ageValue(configMap),
      cell: (configMap: V1ConfigMap) => (
        <AgeCell timestamp={configMap.metadata?.creationTimestamp} />
      ),
    },
  ],

  detail: [
    {
      id: 'metadata',
      title: 'Metadata',
      render: (configMap: V1ConfigMap) => (
        <DetailGrid>
          <DetailRow label="Name">{configMap.metadata?.name}</DetailRow>
          <DetailRow label="Namespace">{configMap.metadata?.namespace}</DetailRow>
          <DetailRow label="Created">
            <AgeCell timestamp={configMap.metadata?.creationTimestamp} /> ago
          </DetailRow>
          <DetailRow label="Immutable">{configMap.immutable ? 'Yes' : 'No'}</DetailRow>
          <DetailRow label="Keys">{keyCount(configMap)}</DetailRow>
          <DetailRow label="Labels">
            <LabelList entries={configMap.metadata?.labels} />
          </DetailRow>
          <DetailRow label="Annotations">
            <LabelList entries={configMap.metadata?.annotations} />
          </DetailRow>
        </DetailGrid>
      ),
    },
    {
      id: 'data',
      title: 'Data',
      render: (configMap: V1ConfigMap) => (
        <div class="flex flex-col gap-1.5">
          {/* `immutable` is enforced by the apiserver: every write to `data` on such a
              ConfigMap is rejected, so offering the controls would only produce a 422.
              Say why instead of silently dropping them. */}
          <Show when={configMap.immutable}>
            <p class="text-2xs text-[var(--text-tertiary)]">
              This ConfigMap is immutable. Its data cannot be changed — recreate it, or delete it
              and apply a new one.
            </p>
          </Show>

          {/* Bounded and scrollable: a single key can be a 500-line config file, and
              without a cap it pushes the section header, and any section after it, off
              the panel entirely. Values wrap and keep their newlines inside the box. */}
          <div class="max-h-96 overflow-y-auto pr-1">
            <KeyValueTable
              entries={dataEntries(configMap)}
              empty="This ConfigMap has no data"
              copyable
              editing={configMap.immutable ? undefined : dataEditing(configMap)}
            />
          </div>
        </div>
      ),
    },
  ],
});
