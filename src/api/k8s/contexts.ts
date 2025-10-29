import { invoke } from '@tauri-apps/api/core';

export interface K8sContext {
  name: string;
  cluster?: string;
  user?: string;
}

export async function listContexts(): Promise<K8sContext[]> {
  return invoke('list_contexts');
}

export async function importKubeContexts(): Promise<void> {
  return invoke('import_kube_contexts');
}
