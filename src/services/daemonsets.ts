import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { EventHandler, EventType } from '../types/k8sEvent';

export interface DaemonSetItem {
  name: string;
  namespace: string;
  ready: string;
  creation_timestamp?: string;
}

export interface DaemonSetEvent {
  type: EventType;
  object: DaemonSetItem;
}

export async function listDaemonSets({
  name,
  namespace,
}: {
  name: string;
  namespace?: string;
}): Promise<DaemonSetItem[]> {
  return await invoke<DaemonSetItem[]>('list_daemonsets', { name, namespace });
}

export async function watchDaemonSets({
  name,
  namespace,
  onEvent,
}: {
  name: string;
  namespace?: string;
  onEvent?: EventHandler<DaemonSetEvent>;
}): Promise<{ eventName: string; unlisten: UnlistenFn }> {
  const eventName = await invoke<string>('watch_daemonsets', { name, namespace });
  const unlisten = await listen<DaemonSetEvent>(eventName, (evt) => {
    try {
      onEvent?.(evt.payload);
    } catch (err) {
      console.error('Error in onEvent handler:', err);
    }
  });
  return { eventName, unlisten };
}
