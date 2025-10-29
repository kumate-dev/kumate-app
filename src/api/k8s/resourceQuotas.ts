import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { EventType, EventHandler } from '@/types/k8sEvent';
import { K8sResponse } from '@/types/k8sResponse';
import { V1ResourceQuota } from '@kubernetes/client-node';

export interface ResourceQuotaEvent {
  type: EventType;
  object: V1ResourceQuota;
}

export async function listResourceQuotas({
  name,
  namespaces,
}: {
  name: string;
  namespaces?: string[];
}): Promise<V1ResourceQuota[]> {
  return await invoke<V1ResourceQuota[]>('list_resource_quotas', { name, namespaces });
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

export async function deleteResourceQuotas({
  name,
  namespace,
  resourceNames,
}: {
  name: string;
  namespace?: string;
  resourceNames: string[];
}): Promise<K8sResponse[]> {
  return await invoke<K8sResponse[]>('delete_resource_quotas', { name, namespace, resourceNames });
}
