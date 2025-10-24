import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { EventHandler, EventType } from '@/types/k8sEvent';
import { K8sResponse } from '@/types/k8sResponse';

export interface PodItem {
  name: string;
  namespace: string;
  phase?: string;
  creation_timestamp?: string;
  containers: number;
  container_states?: string[];
  cpu?: string;
  memory?: string;
  restart?: number;
  node?: string;
  qos?: string;
}

export interface PodEvent {
  type: EventType;
  object: PodItem;
}

export async function listPods({
  name,
  namespaces,
}: {
  name: string;
  namespaces?: string[];
}): Promise<PodItem[]> {
  return await invoke<PodItem[]>('list_pods', { name, namespaces });
}

export async function watchPods({
  name,
  namespaces,
  onEvent,
}: {
  name: string;
  namespaces?: string[];
  onEvent?: EventHandler<PodEvent>;
}): Promise<{ eventName: string; unlisten: UnlistenFn }> {
  const eventName = await invoke<string>('watch_pods', { name, namespaces });

  const unlisten = await listen<PodEvent>(eventName, (evt) => {
    try {
      onEvent?.(evt.payload);
    } catch (err) {
      console.error('Error in onEvent handler:', err);
    }
  });

  return { eventName, unlisten };
}

export async function deletePods({
  name,
  namespace,
  resourceNames,
}: {
  name: string;
  namespace: string;
  resourceNames: string[];
}): Promise<K8sResponse[]> {
  return await invoke<K8sResponse[]>('delete_pods', { name, namespace, resourceNames });
}
