import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { EventHandler, EventType } from '../types/k8sEvent';

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
  namespace,
}: {
  name: string;
  namespace?: string;
}): Promise<PodItem[]> {
  return await invoke<PodItem[]>('list_pods', { name, namespace });
}

export async function watchPods({
  name,
  namespace,
  onEvent,
}: {
  name: string;
  namespace?: string;
  onEvent?: EventHandler<PodEvent>;
}): Promise<{ eventName: string; unlisten: UnlistenFn }> {
  const eventName = await invoke<string>('watch_pods', { name, namespace });
  const unlisten = await listen<PodEvent>(eventName, (evt) => {
    try {
      onEvent?.(evt.payload);
    } catch (err) {
      console.error('Error in onEvent handler:', err);
    }
  });
  return { eventName, unlisten };
}
