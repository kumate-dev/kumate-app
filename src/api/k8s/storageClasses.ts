import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { V1StorageClass } from '@kubernetes/client-node';
import { EventHandler, EventType } from '@/types/k8sEvent';
import { K8sResponse } from '@/types/k8sResponse';

export interface StorageClassEvent {
  type: EventType;
  object: V1StorageClass;
}

export async function listStorageClasses({ name }: { name: string }): Promise<V1StorageClass[]> {
  return await invoke<V1StorageClass[]>('list_storage_classes', { name });
}

export async function watchStorageClasses({
  name,
  onEvent,
}: {
  name: string;
  onEvent?: EventHandler<StorageClassEvent>;
}): Promise<{ eventName: string; unlisten: UnlistenFn }> {
  const eventName = await invoke<string>('watch_storage_classes', { name });
  const unlisten = await listen<StorageClassEvent>(eventName, (evt) => {
    try {
      onEvent?.(evt.payload);
    } catch (err) {
      console.error('Error in onEvent handler:', err);
    }
  });
  return { eventName, unlisten };
}

export async function deleteStorageClasses({
  name,
  resourceNames,
}: {
  name: string;
  resourceNames: string[];
}): Promise<K8sResponse[]> {
  return await invoke<K8sResponse[]>('delete_storage_classes', { name, resourceNames });
}

export async function createStorageClass({
  name,
  manifest,
}: {
  name: string;
  manifest: V1StorageClass;
}): Promise<V1StorageClass> {
  return await invoke<V1StorageClass>('create_storage_class', { name, manifest });
}

export async function updateStorageClass({
  name,
  manifest,
}: {
  name: string;
  manifest: V1StorageClass;
}): Promise<V1StorageClass> {
  return await invoke<V1StorageClass>('update_storage_class', { name, manifest });
}
