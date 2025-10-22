import { invoke } from '@tauri-apps/api/core';
import { EventHandler, EventType } from '@/types/k8sEvent';
import { listen, UnlistenFn } from '@tauri-apps/api/event';

export interface NodeItem {
  name: string;
  cpu?: string;
  memory?: string;
  disk?: string;
  taints?: string;
  roles?: string;
  version?: string;
  creation_timestamp?: string;
  condition?: string;
}

export interface NodeEvent {
  type: EventType;
  object: NodeItem;
}

export async function listNodes({ name }: { name: string }) {
  return invoke('list_nodes', { name });
}

export async function watchNodes({
  name,
  onEvent,
}: {
  name: string;
  onEvent?: EventHandler<NodeEvent>;
}): Promise<{ eventName: string; unlisten: UnlistenFn }> {
  const eventName = await invoke<string>('watch_nodes', { name });
  const unlisten = await listen<NodeEvent>(eventName, (evt) => {
    try {
      onEvent?.(evt.payload);
    } catch (err) {
      console.error('Error in onEvent handler:', err);
    }
  });
  return { eventName, unlisten };
}
