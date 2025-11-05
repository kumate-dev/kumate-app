import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { EventHandler, EventType } from '@/types/k8sEvent';
import type { V1LimitRange } from '@kubernetes/client-node';
import { K8sResponse } from '@/types/k8sResponse';

export interface LimitRangeEvent {
  type: EventType;
  object: V1LimitRange;
}

export async function createLimitRange({
  name,
  namespace,
  manifest,
}: {
  name: string;
  namespace?: string;
  manifest: V1LimitRange;
}): Promise<V1LimitRange> {
  return await invoke<V1LimitRange>('create_limit_range', { name, namespace, manifest });
}

export async function updateLimitRange({
  name,
  namespace,
  manifest,
}: {
  name: string;
  namespace?: string;
  manifest: V1LimitRange;
}): Promise<V1LimitRange> {
  return await invoke<V1LimitRange>('update_limit_range', { name, namespace, manifest });
}

export async function listLimitRanges({
  name,
  namespaces,
}: {
  name: string;
  namespaces?: string[];
}): Promise<V1LimitRange[]> {
  return await invoke<V1LimitRange[]>('list_limit_ranges', { name, namespaces });
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
  const eventName = await invoke<string>('watch_limit_ranges', { name, namespaces });

  const unlisten = await listen<LimitRangeEvent>(eventName, (evt) => {
    try {
      onEvent?.(evt.payload);
    } catch (err) {
      console.error('Error in onEvent handler:', err);
    }
  });

  return { eventName, unlisten };
}

export async function deleteLimitRanges({
  name,
  namespace,
  resourceNames,
}: {
  name: string;
  namespace?: string;
  resourceNames: string[];
}): Promise<K8sResponse[]> {
  return await invoke<K8sResponse[]>('delete_limit_ranges', {
    name,
    namespace,
    resourceNames,
  });
}
