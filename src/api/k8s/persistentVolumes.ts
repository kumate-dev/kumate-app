import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { V1PersistentVolume } from '@kubernetes/client-node';
import { EventHandler, EventType } from '@/types/k8sEvent';
import { K8sResponse } from '@/types/k8sResponse';

export interface PersistentVolumeEvent {
  type: EventType;
  object: V1PersistentVolume;
}

export async function listPersistentVolumes({
  name,
}: {
  name: string;
}): Promise<V1PersistentVolume[]> {
  return await invoke<V1PersistentVolume[]>('list_persistent_volumes', { name });
}

export async function watchPersistentVolumes({
  name,
  onEvent,
}: {
  name: string;
  onEvent?: EventHandler<PersistentVolumeEvent>;
}): Promise<{ eventName: string; unlisten: UnlistenFn }> {
  const eventName = await invoke<string>('watch_persistent_volumes', { name });
  const unlisten = await listen<PersistentVolumeEvent>(eventName, (evt) => {
    try {
      onEvent?.(evt.payload);
    } catch (err) {
      console.error('Error in onEvent handler:', err);
    }
  });
  return { eventName, unlisten };
}

export async function deletePersistentVolumes({
  name,
  resourceNames,
}: {
  name: string;
  resourceNames: string[];
}): Promise<K8sResponse[]> {
  return await invoke<K8sResponse[]>('delete_persistent_volumes', { name, resourceNames });
}

export async function createPersistentVolume({
  name,
  manifest,
}: {
  name: string;
  manifest: V1PersistentVolume;
}): Promise<V1PersistentVolume> {
  return await invoke<V1PersistentVolume>('create_persistent_volume', { name, manifest });
}

export async function updatePersistentVolume({
  name,
  manifest,
}: {
  name: string;
  manifest: V1PersistentVolume;
}): Promise<V1PersistentVolume> {
  return await invoke<V1PersistentVolume>('update_persistent_volume', { name, manifest });
}