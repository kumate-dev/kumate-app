import { invoke } from '@tauri-apps/api/core';

export interface K8sContext {
  name: string;
  display_name?: string;
  cluster?: string;
  user?: string;
  avatar?: number[]; // raw bytes from backend
}

export async function listContexts(): Promise<K8sContext[]> {
  const contexts = (await invoke('list_contexts')) as K8sContext[];
  return contexts;
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

export async function updateContextMetadata(
  name: string,
  displayName?: string,
  avatarBase64?: string
): Promise<K8sContext> {
  const payload: Record<string, unknown> = {
    name,
    display_name: displayName,
    avatar_base64: avatarBase64,
  };
  return invoke('update_context_metadata', { args: payload });
}
