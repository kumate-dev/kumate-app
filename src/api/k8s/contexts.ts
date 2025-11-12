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

export interface ContextConnectionItem {
  name: string;
  connected: boolean;
}

export async function setContextConnection(name: string, connected: boolean): Promise<void> {
  await invoke('set_context_connection', { name, connected });
}

export async function getContextConnections(): Promise<ContextConnectionItem[]> {
  const list = (await invoke('get_context_connections')) as [string, boolean][];
  return list.map(([name, connected]) => ({ name, connected }));
}

export async function getContextConnection(name: string): Promise<boolean> {
  return invoke('get_context_connection', { name });
}

export async function checkContextConnection(name: string): Promise<void> {
  return invoke('check_context_connection', { name });
}

export async function getContextVersion(name: string): Promise<string> {
  return invoke('get_context_version', { name });
}
