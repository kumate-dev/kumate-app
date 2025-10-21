import { invoke } from '@tauri-apps/api/core';
import { listen, UnlistenFn } from '@tauri-apps/api/event';

// --- Types ---
export interface K8sContext {
  name: string;
  cluster?: string;
  user?: string;
}

export interface PodItem {
  name: string;
  namespace: string;
  status?: string;
  age?: string;
}

export type EventHandler<T> = (payload: T) => void;

// --- Contexts ---
export async function listContexts(): Promise<K8sContext[]> {
  return invoke('list_contexts');
}

export async function addContext(payload: K8sContext): Promise<void> {
  return invoke('add_context', { payload });
}

export async function deleteContext(name: string): Promise<void> {
  return invoke('delete_context', { name });
}

export async function getContextSecrets(name: string): Promise<Record<string, string>> {
  return invoke('get_context_secrets', { name });
}

export async function unwatch({ name }: { name: string }): Promise<void> {
  try {
    await invoke('unwatch', { name });
  } catch (err) {
    console.warn('unwatch failed:', err);
  }
}

// --- Pods ---
export async function listPods({
  name,
  namespace,
}: {
  name: string;
  namespace?: string;
}): Promise<PodItem[]> {
  return invoke('list_pods', { name, namespace });
}

export async function listDaemonSets({ name, namespace }: { name: string; namespace?: string }) {
  return invoke('list_daemonsets', { name, namespace });
}

export async function importKubeContexts(): Promise<void> {
  return invoke('import_kube_contexts');
}

export async function listNodes({ name }: { name: string }) {
  return invoke('list_nodes', { name });
}

export async function listStatefulSets({ name, namespace }: { name: string; namespace: string }) {
  return invoke('list_statefulsets', { name, namespace });
}

export async function listReplicaSets({ name, namespace }: { name: string; namespace: string }) {
  return invoke('list_replicasets', { name, namespace });
}

export async function listReplicationControllers({
  name,
  namespace,
}: {
  name: string;
  namespace: string;
}) {
  return invoke('list_replicationcontrollers', { name, namespace });
}

export async function listJobs({ name, namespace }: { name: string; namespace: string }) {
  return invoke('list_jobs', { name, namespace });
}

export async function listCronJobs({ name, namespace }: { name: string; namespace: string }) {
  return invoke('list_cronjobs', { name, namespace });
}
