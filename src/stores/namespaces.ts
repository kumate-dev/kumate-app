import { createEffect, createMemo, createSignal } from 'solid-js';
import { listNamespaces, watchNamespaces } from '@/api/k8s/namespaces';
import { ALL_NAMESPACES } from '@/constants/k8s';
import { createResourceList } from '@/lib/createResourceList';
import { resourceName } from '@/lib/k8s';
import { selectedName } from '@/stores/clusters';

/**
 * Namespace list for the selected cluster, plus the user's namespace filter.
 *
 * Replaces `namespaceStore.ts` (the only zustand store in the codebase). Note the bug
 * that store carried: `setNamespaces` built `namespaces` as a fresh single-key object
 * every time, discarding all other contexts — so its `Record<context, V1Namespace[]>`
 * type was a lie and it only ever held one cluster. Since the list is scoped to the
 * selected cluster anyway, the shape here is simply "the current cluster's namespaces".
 */

const STORAGE_KEY = 'kumate.selectedNamespaces';

const readStored = (): string[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed) && parsed.every((v) => typeof v === 'string')) return parsed;
  } catch {
    // Corrupt value: fall through to the default rather than breaking startup.
  }
  return [ALL_NAMESPACES];
};

const [selected, setSelectedSignal] = createSignal<string[]>(readStored());

/** The namespace list itself is watched, so it stays live as namespaces come and go. */
const namespaceList = createResourceList(
  { list: listNamespaces, watch: watchNamespaces },
  selectedName,
  // Namespaces are cluster-scoped: no namespace filter applies to them.
  () => undefined
);

export const namespaces = createMemo(() =>
  namespaceList
    .items()
    .map(resourceName)
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
);

export const namespacesStatus = namespaceList.status;

export { selected as selectedNamespaces };

export const isAllNamespaces = createMemo(() => selected().includes(ALL_NAMESPACES));

/**
 * The namespace filter to send to the backend: `undefined` means cluster-wide.
 *
 * Pass this to `createResourceList` rather than the raw selection — it collapses the
 * `ALL_NAMESPACES` sentinel, so the backend opens one cluster-wide watch instead of
 * one watch per namespace.
 */
export const namespaceFilter = createMemo(() => {
  const value = selected();
  return value.length === 0 || value.includes(ALL_NAMESPACES) ? undefined : value;
});

export const setSelectedNamespaces = (next: string[]) => {
  // Selecting a specific namespace clears the sentinel, and vice versa — they are
  // mutually exclusive and the old UI allowed both at once, which sent a filter the
  // backend then ignored.
  const cleaned = next.includes(ALL_NAMESPACES)
    ? [ALL_NAMESPACES]
    : next.filter((n) => n !== ALL_NAMESPACES);

  const value = cleaned.length === 0 ? [ALL_NAMESPACES] : cleaned;
  setSelectedSignal(value);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
};

export const toggleNamespace = (name: string) => {
  // Drop the sentinel *before* toggling, not after.
  //
  // The selection starts as `[ALL_NAMESPACES]`, so the naive version built
  // `['All Namespaces', 'default']` and handed it to `setSelectedNamespaces`, whose
  // mutual-exclusion rule then collapsed it back to `[ALL_NAMESPACES]`. Picking a
  // namespace was a no-op every single time. Ticking a real namespace means "stop
  // showing all of them", so the sentinel has to lose.
  const current = selected().filter((n) => n !== ALL_NAMESPACES);

  setSelectedNamespaces(
    current.includes(name) ? current.filter((n) => n !== name) : [...current, name]
  );
};

/**
 * Drop namespaces that do not exist in the newly selected cluster.
 *
 * Without this, switching clusters keeps a filter for namespaces the new cluster has
 * never heard of and every resource list comes back empty with no explanation.
 */
createEffect(() => {
  const available = namespaces();
  if (namespacesStatus() !== 'ready' || available.length === 0) return;

  const current = selected();
  if (current.includes(ALL_NAMESPACES)) return;

  const stillValid = current.filter((n) => available.includes(n));
  if (stillValid.length !== current.length) {
    setSelectedNamespaces(stillValid);
  }
});
