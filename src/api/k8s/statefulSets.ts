import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { EventHandler, EventType } from '@/types/k8sEvent';
import type { V1StatefulSet } from '@kubernetes/client-node';
import { K8sResponse } from '@/types/k8sResponse';

export interface StatefulSetEvent {
  type: EventType;
  object: V1StatefulSet;
}

export async function listStatefulSets({
  name,
  namespaces,
}: {
  name: string;
  namespaces?: string[];
}): Promise<V1StatefulSet[]> {
  return await invoke<V1StatefulSet[]>('list_replication_controllers', {
    name,
    namespaces,
  });
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
  const eventName = await invoke<string>('watch_replication_controllers', { name, namespaces });

  const unlisten = await listen<StatefulSetEvent>(eventName, (evt) => {
    try {
      onEvent?.(evt.payload);
    } catch (err) {
      console.error('Error in onEvent handler:', err);
    }
  });

  return { eventName, unlisten };
}

export async function deleteStatefulSets({
  name,
  namespace,
  resourceNames,
}: {
  name: string;
  namespace?: string;
  resourceNames: string[];
}): Promise<K8sResponse[]> {
  return await invoke<K8sResponse[]>('delete_replication_controllers', {
    name,
    namespace,
    resourceNames,
  });
}
