import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { V1Namespace } from '@kubernetes/client-node';
import { EventHandler, EventType } from '@/types/k8sEvent';
import { K8sResponse } from '@/types/k8sResponse';

export interface NamespaceEvent {
  type: EventType;
  object: V1Namespace;
}

export async function listNamespaces({ name }: { name: string }): Promise<V1Namespace[]> {
  return await invoke<V1Namespace[]>('list_namespaces', { name });
}

export async function watchNamespaces({
  name,
  onEvent,
}: {
  name: string;
  onEvent?: EventHandler<NamespaceEvent>;
}): Promise<{ eventName: string; unlisten: UnlistenFn }> {
  const eventName = await invoke<string>('watch_namespaces', { name });

  const unlisten = await listen<NamespaceEvent>(eventName, (evt) => {
    try {
      onEvent?.(evt.payload);
    } catch (err) {
      console.error('Error in onEvent handler:', err);
    }
  });

  return { eventName, unlisten };
}

export async function deleteNamespaces({
  name,
  resourceNames,
}: {
  name: string;
  resourceNames: string[];
}): Promise<K8sResponse[]> {
  return await invoke<K8sResponse[]>('delete_namespaces', {
    name,
    resourceNames,
  });
}
