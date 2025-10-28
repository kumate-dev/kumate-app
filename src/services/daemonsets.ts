import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { EventHandler, EventType } from '@/types/k8sEvent';
import type { V1DaemonSet } from '@kubernetes/client-node';
import { K8sResponse } from '@/types/k8sResponse';

export interface DaemonSetEvent {
  type: EventType;
  object: V1DaemonSet;
}

export async function listDaemonSets({
  name,
  namespaces,
}: {
  name: string;
  namespaces?: string[];
}): Promise<V1DaemonSet[]> {
  return await invoke<V1DaemonSet[]>('list_daemon_sets', { name, namespaces });
}

export async function watchDaemonSets({
  name,
  namespaces,
  onEvent,
}: {
  name: string;
  namespaces?: string[];
  onEvent?: EventHandler<DaemonSetEvent>;
}): Promise<{ eventName: string; unlisten: UnlistenFn }> {
  const eventName = await invoke<string>('watch_daemon_sets', { name, namespaces });

  const unlisten = await listen<DaemonSetEvent>(eventName, (evt) => {
    try {
      onEvent?.(evt.payload);
    } catch (err) {
      console.error('Error in onEvent handler:', err);
    }
  });

  return { eventName, unlisten };
}

export async function deleteDaemonSets({
  name,
  namespace,
  resourceNames,
}: {
  name: string;
  namespace?: string;
  resourceNames: string[];
}): Promise<K8sResponse[]> {
  return await invoke<K8sResponse[]>('delete_daemon_sets', {
    name,
    namespace,
    resourceNames,
  });
}
