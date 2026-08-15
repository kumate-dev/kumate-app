import { createSignal, createResource, batch } from 'solid-js';
import {
  getContextConnections,
  importKubeContexts,
  listContexts,
  setContextConnection,
  type K8sContext,
} from '@/api/k8s/contexts';
import { stopClusterWatches } from '@/lib/createResourceList';
import { getErrorMessage } from '@/utils/error';

const SELECTED_KEY = 'kumate.selectedContext';

/**
 * Cluster/context selection and connection state.
 *
 * A module-level store rather than a Solid context provider: there is exactly one
 * cluster selection in the application, every screen reads it, and a provider would
 * only add a tree dependency for no isolation benefit. Signals are already
 * fine-grained, so this does not cause the wide re-renders a global React store would.
 */

const [selectedName, setSelectedName] = createSignal<string | null>(
  localStorage.getItem(SELECTED_KEY)
);

const [connections, setConnections] = createSignal<Record<string, boolean>>({});
const [error, setError] = createSignal<string | null>(null);

const [contexts, { refetch: refetchContexts }] = createResource(async () => {
  try {
    const list = await listContexts();
    setError(null);
    return list;
  } catch (err) {
    setError(getErrorMessage(err));
    return [] as K8sContext[];
  }
});

export { contexts, selectedName, connections, error as clustersError };

export const selectedContext = () => {
  const name = selectedName();
  if (!name) return null;
  return contexts()?.find((c) => c.name === name) ?? null;
};

export const isConnected = (name: string) => connections()[name] ?? true;

/**
 * Switch the selected cluster.
 *
 * Watches for the outgoing cluster are stopped explicitly. Each resource list also
 * cleans up its own watch, but a page that was disposed without its cleanup running
 * would otherwise leave a watcher open — and the backend caps them at 64.
 */
export const selectCluster = (name: string | null) => {
  const previous = selectedName();
  if (previous === name) return;

  if (previous) void stopClusterWatches(previous);

  batch(() => {
    setSelectedName(name);
  });

  if (name) {
    localStorage.setItem(SELECTED_KEY, name);
  } else {
    localStorage.removeItem(SELECTED_KEY);
  }
};

export const refreshConnections = async () => {
  try {
    const list = await getContextConnections();
    setConnections(Object.fromEntries(list.map(({ name, connected }) => [name, connected])));
  } catch (err) {
    console.warn('failed to load connection state', err);
  }
};

export const setConnected = async (name: string, connected: boolean) => {
  // Optimistic: the toggle should feel instant. The backend call only fails if IPC
  // itself is broken, in which case we roll back.
  const previous = connections()[name];
  setConnections((prev) => ({ ...prev, [name]: connected }));

  try {
    await setContextConnection(name, connected);
  } catch (err) {
    setConnections((prev) => ({ ...prev, [name]: previous ?? true }));
    throw err;
  }
};

export const importContexts = async () => {
  await importKubeContexts();
  await refetchContexts();
};

export const initClusters = async () => {
  await refreshConnections();

  // Auto-select when there is no stored choice, so a first run lands on something
  // rather than an empty shell.
  const list = contexts();
  if (!selectedName() && list && list.length > 0) {
    const first = list[0];
    if (first) selectCluster(first.name);
  }
};
