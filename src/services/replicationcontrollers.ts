import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { EventHandler, EventType } from '@/types/k8sEvent';

export interface ReplicationControllerItem {
  name: string;
  namespace: string;
  ready: string;
  creation_timestamp?: string;
}

export interface ReplicationControllerEvent {
  type: EventType;
  object: ReplicationControllerItem;
}

export async function listReplicationControllers({
  name,
  namespaces,
}: {
  name: string;
  namespaces?: string[];
}): Promise<ReplicationControllerItem[]> {
  return await invoke<ReplicationControllerItem[]>('list_replication_controllers', {
    name,
    namespaces,
  });
}

export async function watchReplicationControllers({
  name,
  namespaces,
  onEvent,
}: {
  name: string;
  namespaces?: string[];
  onEvent?: EventHandler<ReplicationControllerEvent>;
}): Promise<{ eventName: string; unlisten: UnlistenFn }> {
  const eventName = await invoke<string>('watch_replication_controllers', { name, namespaces });

  const unlisten = await listen<ReplicationControllerEvent>(eventName, (evt) => {
    try {
      onEvent?.(evt.payload);
    } catch (err) {
      console.error('Error in onEvent handler:', err);
    }
  });

  return { eventName, unlisten };
}
