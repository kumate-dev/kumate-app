import { invoke } from '@tauri-apps/api/core';
import { EventHandler } from './k8s';
import { listen, UnlistenFn } from '@tauri-apps/api/event';

export interface NamespaceItem {
  name: string;
  status?: string;
  creation_timestamp?: string;
}

export interface NamespaceEvent {
  type: 'ADDED' | 'MODIFIED' | 'DELETED';
  object: NamespaceItem;
}

export async function listNamespaces({ name }: { name: string }): Promise<NamespaceItem[]> {
  return invoke('list_namespaces', { name });
}

export async function watchNamespaces({
  name,
  onEvent,
}: {
  name: string;
  onEvent?: EventHandler<NamespaceEvent>;
}): Promise<{ eventName: string; unlisten: UnlistenFn }> {
  const eventName = await invoke<string>('watch_namespaces', { name });
  const unlisten = await listen<NamespaceEvent>(eventName, (evt) => {
    try {
      onEvent?.(evt.payload);
    } catch (err) {
      console.error('Error in onEvent handler:', err);
    }
  });
  return { eventName, unlisten };
}
