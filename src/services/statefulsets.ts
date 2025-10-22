import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { EventHandler, EventType } from '@/types/k8sEvent';

export interface StatefulSetItem {
  name: string;
  namespace: string;
  ready: string;
  creation_timestamp?: string;
}

export interface StatefulSetEvent {
  type: EventType;
  object: StatefulSetItem;
}

export async function listStatefulSets({
  name,
  namespaces,
}: {
  name: string;
  namespaces?: string[];
}): Promise<StatefulSetItem[]> {
  return await invoke<StatefulSetItem[]>('list_statefulsets', { name, namespaces });
}

export async function watchStatefulSets({
  name,
  namespaces,
  onEvent,
}: {
  name: string;
  namespaces?: string[];
  onEvent?: EventHandler<StatefulSetEvent>;
}): Promise<{ eventName: string; unlisten: UnlistenFn }> {
  const eventName = await invoke<string>('watch_statefulsets', { name, namespaces });

  const unlisten = await listen<StatefulSetEvent>(eventName, (evt) => {
    try {
      onEvent?.(evt.payload);
    } catch (err) {
      console.error('Error in onEvent handler:', err);
    }
  });

  return { eventName, unlisten };
}
