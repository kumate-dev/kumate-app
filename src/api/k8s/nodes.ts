import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { V1Node } from '@kubernetes/client-node';
import { EventHandler, EventType } from '@/types/k8sEvent';
import { K8sResponse } from '@/types/k8sResponse';

export interface NodeEvent {
  type: EventType;
  object: V1Node;
}

export async function listNodes({ name }: { name: string }): Promise<V1Node[]> {
  return await invoke<V1Node[]>('list_nodes', { name });
}

export async function watchNodes({
  name,
  onEvent,
}: {
  name: string;
  onEvent?: EventHandler<NodeEvent>;
}): Promise<{ eventName: string; unlisten: UnlistenFn }> {
  const eventName = await invoke<string>('watch_nodes', { name });

  const unlisten = await listen<NodeEvent>(eventName, (evt) => {
    try {
      onEvent?.(evt.payload);
    } catch (err) {
      console.error('Error in onEvent handler:', err);
    }
  });

  return { eventName, unlisten };
}

export async function deleteNodes({
  name,
  resourceNames,
}: {
  name: string;
  resourceNames: string[];
}): Promise<K8sResponse[]> {
  return await invoke<K8sResponse[]>('delete_nodes', {
    name,
    resourceNames,
  });
}
