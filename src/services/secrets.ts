import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { EventHandler, EventType } from '@/types/k8sEvent';

export interface SecretItem {
  name: string;
  namespace: string;
  type_: string;
  data_keys: string[];
  creation_timestamp?: string;
}

export interface SecretEvent {
  type: EventType;
  object: SecretItem;
}

export async function listSecrets({
  name,
  namespaces,
}: {
  name: string;
  namespaces?: string[];
}): Promise<SecretItem[]> {
  return await invoke<SecretItem[]>('list_secrets', { name, namespaces });
}

export async function watchSecrets({
  name,
  namespaces,
  onEvent,
}: {
  name: string;
  namespaces?: string[];
  onEvent?: EventHandler<SecretEvent>;
}): Promise<{ eventName: string; unlisten: UnlistenFn }> {
  const eventName = await invoke<string>('watch_secrets', { name, namespaces });

  const unlisten = await listen<SecretEvent>(eventName, (evt) => {
    try {
      onEvent?.(evt.payload);
    } catch (err) {
      console.error('Error in onEvent handler:', err);
    }
  });

  return { eventName, unlisten };
}
