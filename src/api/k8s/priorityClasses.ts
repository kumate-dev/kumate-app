import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { V1PriorityClass } from '@kubernetes/client-node';
import { EventHandler, EventType } from '@/types/k8sEvent';
import { K8sResponse } from '@/types/k8sResponse';

export interface PriorityClassEvent {
  type: EventType;
  object: V1PriorityClass;
}

export async function listPriorityClasses({ name }: { name: string }): Promise<V1PriorityClass[]> {
  return await invoke<V1PriorityClass[]>('list_priority_classes', { name });
}

export async function watchPriorityClasses({
  name,
  onEvent,
}: {
  name: string;
  onEvent?: EventHandler<PriorityClassEvent>;
}): Promise<{ eventName: string; unlisten: UnlistenFn }> {
  const eventName = await invoke<string>('watch_priority_classes', { name });

  const unlisten = await listen<PriorityClassEvent>(eventName, (evt) => {
    try {
      onEvent?.(evt.payload);
    } catch (err) {
      console.error('Error in onEvent handler:', err);
    }
  });

  return { eventName, unlisten };
}

export async function createPriorityClass({
  name,
  manifest,
}: {
  name: string;
  namespace?: string;
  manifest: V1PriorityClass;
}): Promise<V1PriorityClass> {
  return await invoke<V1PriorityClass>('create_priority_class', { name, manifest });
}

export async function updatePriorityClass({
  name,
  manifest,
}: {
  name: string;
  namespace?: string;
  manifest: V1PriorityClass;
}): Promise<V1PriorityClass> {
  return await invoke<V1PriorityClass>('update_priority_class', { name, manifest });
}

export async function deletePriorityClasses({
  name,
  resourceNames,
}: {
  name: string;
  resourceNames: string[];
}): Promise<K8sResponse[]> {
  return await invoke<K8sResponse[]>('delete_priority_classes', {
    name,
    resourceNames,
  });
}
