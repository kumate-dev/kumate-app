import { invoke } from '@tauri-apps/api/core';

export interface K8sContext {
  name: string;
  cluster?: string;
  user?: string;
}

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

export async function importKubeContexts(): Promise<void> {
  return invoke('import_kube_contexts');
}
