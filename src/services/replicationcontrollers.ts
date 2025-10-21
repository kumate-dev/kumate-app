import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { EventHandler, EventType } from '../types/k8sEvent';

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
  namespace,
}: {
  name: string;
  namespace?: string;
}): Promise<ReplicationControllerItem[]> {
  return await invoke<ReplicationControllerItem[]>('list_replicationcontrollers', {
    name,
    namespace,
  });
}

export async function watchReplicationControllers({
  name,
  namespace,
  onEvent,
}: {
  name: string;
  namespace?: string;
  onEvent?: EventHandler<ReplicationControllerEvent>;
}): Promise<{ eventName: string; unlisten: UnlistenFn }> {
  const eventName = await invoke<string>('watch_replicationcontrollers', { name, namespace });
  const unlisten = await listen<ReplicationControllerEvent>(eventName, (evt) => {
    try {
      onEvent?.(evt.payload);
    } catch (err) {
      console.error('Error in onEvent handler:', err);
    }
  });
  return { eventName, unlisten };
}
