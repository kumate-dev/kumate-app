import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { V1RuntimeClass } from '@kubernetes/client-node';
import { EventHandler, EventType } from '@/types/k8sEvent';
import { K8sResponse } from '@/types/k8sResponse';

export interface RuntimeClassEvent {
  type: EventType;
  object: V1RuntimeClass;
}

export async function listRuntimeClasses({ name }: { name: string }): Promise<V1RuntimeClass[]> {
  return await invoke<V1RuntimeClass[]>('list_runtime_classes', { name });
}

export async function watchRuntimeClasses({
  name,
  onEvent,
}: {
  name: string;
  onEvent?: EventHandler<RuntimeClassEvent>;
}): Promise<{ eventName: string; unlisten: UnlistenFn }> {
  const eventName = await invoke<string>('watch_runtime_classes', { name });

  const unlisten = await listen<RuntimeClassEvent>(eventName, (evt) => {
    try {
      onEvent?.(evt.payload);
    } catch (err) {
      console.error('Error in onEvent handler:', err);
    }
  });

  return { eventName, unlisten };
}

export async function createRuntimeClass({
  name,
  manifest,
}: {
  name: string;
  namespace?: string;
  manifest: V1RuntimeClass;
}): Promise<V1RuntimeClass> {
  return await invoke<V1RuntimeClass>('create_runtime_class', { name, manifest });
}

export async function updateRuntimeClass({
  name,
  manifest,
}: {
  name: string;
  namespace?: string;
  manifest: V1RuntimeClass;
}): Promise<V1RuntimeClass> {
  return await invoke<V1RuntimeClass>('update_runtime_class', { name, manifest });
}

export async function deleteRuntimeClasses({
  name,
  resourceNames,
}: {
  name: string;
  resourceNames: string[];
}): Promise<K8sResponse[]> {
  return await invoke<K8sResponse[]>('delete_runtime_classes', {
    name,
    resourceNames,
  });
}
