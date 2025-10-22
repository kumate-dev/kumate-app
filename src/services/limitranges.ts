import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { EventHandler, EventType } from '@/types/k8sEvent';

export interface LimitRangeItem {
  name: string;
  namespace: string;
  type_: string;
  min?: Record<string, string>;
  max?: Record<string, string>;
  default?: Record<string, string>;
  defaultRequest?: Record<string, string>;
  creation_timestamp?: string;
}

export interface LimitRangeEvent {
  type: EventType;
  object: LimitRangeItem;
}

export async function listLimitRanges({
  name,
  namespaces,
}: {
  name: string;
  namespaces?: string[];
}): Promise<LimitRangeItem[]> {
  return await invoke<LimitRangeItem[]>('list_limitranges', { name, namespaces });
}

export async function watchLimitRanges({
  name,
  namespaces,
  onEvent,
}: {
  name: string;
  namespaces?: string[];
  onEvent?: EventHandler<LimitRangeEvent>;
}): Promise<{ eventName: string; unlisten: UnlistenFn }> {
  const eventName = await invoke<string>('watch_limitranges', { name, namespaces });

  const unlisten = await listen<LimitRangeEvent>(eventName, (evt) => {
    try {
      onEvent?.(evt.payload);
    } catch (err) {
      console.error('Error in onEvent handler:', err);
    }
  });

  return { eventName, unlisten };
}
