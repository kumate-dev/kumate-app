import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { EventType, EventHandler } from '@/types/k8sEvent';

export interface ResourceQuotaItem {
  name: string;
  namespace: string;
  hard: [string, string][];
  used: [string, string][];
  creation_timestamp?: string;
}

export interface ResourceQuotaEvent {
  type: EventType;
  object: ResourceQuotaItem;
}

export async function listResourceQuotas({
  name,
  namespaces,
}: {
  name: string;
  namespaces?: string[];
}): Promise<ResourceQuotaItem[]> {
  return await invoke<ResourceQuotaItem[]>('list_resource_quotas', { name, namespaces });
}

export async function watchResourceQuotas({
  name,
  namespaces,
  onEvent,
}: {
  name: string;
  namespaces?: string[];
  onEvent?: EventHandler<ResourceQuotaEvent>;
}): Promise<{ eventName: string; unlisten: UnlistenFn }> {
  const eventName = await invoke<string>('watch_resource_quotas', { name, namespaces });

  const unlisten = await listen<ResourceQuotaEvent>(eventName, (evt) => {
    try {
      onEvent?.(evt.payload);
    } catch (err) {
      console.error('Error in onEvent handler:', err);
    }
  });

  return { eventName, unlisten };
}
