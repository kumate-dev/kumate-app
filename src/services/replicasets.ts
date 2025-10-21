import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export interface ReplicaSetItem {
  name: string;
  namespace: string;
  ready: string;
  creation_timestamp: string;
}

export interface ReplicaSetEvent {
  type: 'ADDED' | 'MODIFIED' | 'DELETED';
  object: ReplicaSetItem;
}

export type EventHandler<T> = (event: T) => void;

export async function listReplicaSets({
  name,
  namespace,
}: {
  name: string;
  namespace?: string;
}): Promise<ReplicaSetItem[]> {
  return await invoke<ReplicaSetItem[]>('list_replicasets', { name, namespace });
}

export async function watchReplicaSets({
  name,
  namespace,
  onEvent,
}: {
  name: string;
  namespace?: string;
  onEvent?: EventHandler<ReplicaSetEvent>;
}): Promise<{ eventName: string; unlisten: UnlistenFn }> {
  const eventName = await invoke<string>('watch_replicasets', { name, namespace });
  const unlisten = await listen<ReplicaSetEvent>(eventName, (evt) => {
    try {
      onEvent?.(evt.payload);
    } catch (err) {
      console.error('Error in onEvent handler:', err);
    }
  });
  return { eventName, unlisten };
}
