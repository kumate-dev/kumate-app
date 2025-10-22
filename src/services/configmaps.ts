import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { EventHandler, EventType } from '@/types/k8sEvent';

export interface ConfigMapItem {
  name: string;
  namespace: string;
  data_keys: string[];
  creation_timestamp?: string;
}

export interface ConfigMapEvent {
  type: EventType;
  object: ConfigMapItem;
}

export async function listConfigMaps({
  name,
  namespaces,
}: {
  name: string;
  namespaces?: string[];
}): Promise<ConfigMapItem[]> {
  return await invoke<ConfigMapItem[]>('list_configmaps', { name, namespaces });
}

export async function watchConfigMaps({
  name,
  namespaces,
  onEvent,
}: {
  name: string;
  namespaces?: string[];
  onEvent?: EventHandler<ConfigMapEvent>;
}): Promise<{ eventName: string; unlisten: UnlistenFn }> {
  const eventName = await invoke<string>('watch_configmaps', { name, namespaces });

  const unlisten = await listen<ConfigMapEvent>(eventName, (evt) => {
    try {
      onEvent?.(evt.payload);
    } catch (err) {
      console.error('Error in onEvent handler:', err);
    }
  });

  return { eventName, unlisten };
}
