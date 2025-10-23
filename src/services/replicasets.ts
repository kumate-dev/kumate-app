import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { EventHandler, EventType } from '@/types/k8sEvent';

export interface ReplicaSetItem {
  name: string;
  namespace: string;
  ready: string;
  creation_timestamp?: string;
}

export interface ReplicaSetEvent {
  type: EventType;
  object: ReplicaSetItem;
}

export async function listReplicaSets({
  name,
  namespaces,
}: {
  name: string;
  namespaces?: string[];
}): Promise<ReplicaSetItem[]> {
  return await invoke<ReplicaSetItem[]>('list_replica_sets', { name, namespaces });
}

export async function watchReplicaSets({
  name,
  namespaces,
  onEvent,
}: {
  name: string;
  namespaces?: string[];
  onEvent?: EventHandler<ReplicaSetEvent>;
}): Promise<{ eventName: string; unlisten: UnlistenFn }> {
  const eventName = await invoke<string>('watch_replica_sets', { name, namespaces });

  const unlisten = await listen<ReplicaSetEvent>(eventName, (evt) => {
    try {
      onEvent?.(evt.payload);
    } catch (err) {
      console.error('Error in onEvent handler:', err);
    }
  });

  return { eventName, unlisten };
}
