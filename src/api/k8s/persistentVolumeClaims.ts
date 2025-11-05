import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { EventHandler, EventType } from '@/types/k8sEvent';
import type { V1PersistentVolumeClaim } from '@kubernetes/client-node';
import { K8sResponse } from '@/types/k8sResponse';

export interface PersistentVolumeClaimEvent {
  type: EventType;
  object: V1PersistentVolumeClaim;
}

export async function createPersistentVolumeClaim({
  name,
  namespace,
  manifest,
}: {
  name: string;
  namespace?: string;
  manifest: V1PersistentVolumeClaim;
}): Promise<V1PersistentVolumeClaim> {
  return await invoke<V1PersistentVolumeClaim>('create_persistent_volume_claim', {
    name,
    namespace,
    manifest,
  });
}

export async function updatePersistentVolumeClaim({
  name,
  namespace,
  manifest,
}: {
  name: string;
  namespace?: string;
  manifest: V1PersistentVolumeClaim;
}): Promise<V1PersistentVolumeClaim> {
  return await invoke<V1PersistentVolumeClaim>('update_persistent_volume_claim', {
    name,
    namespace,
    manifest,
  });
}

export async function listPersistentVolumeClaims({
  name,
  namespaces,
}: {
  name: string;
  namespaces?: string[];
}): Promise<V1PersistentVolumeClaim[]> {
  return await invoke<V1PersistentVolumeClaim[]>('list_persistent_volume_claims', {
    name,
    namespaces,
  });
}

export async function watchPersistentVolumeClaims({
  name,
  namespaces,
  onEvent,
}: {
  name: string;
  namespaces?: string[];
  onEvent?: EventHandler<PersistentVolumeClaimEvent>;
}): Promise<{ eventName: string; unlisten: UnlistenFn }> {
  const eventName = await invoke<string>('watch_persistent_volume_claims', { name, namespaces });
  const unlisten = await listen<PersistentVolumeClaimEvent>(eventName, (evt) => {
    try {
      onEvent?.(evt.payload);
    } catch (err) {
      console.error('Error in onEvent handler:', err);
    }
  });

  return { eventName, unlisten };
}

export async function deletePersistentVolumeClaims({
  name,
  namespace,
  resourceNames,
}: {
  name: string;
  namespace?: string;
  resourceNames: string[];
}): Promise<K8sResponse[]> {
  return await invoke<K8sResponse[]>('delete_persistent_volume_claims', {
    name,
    namespace,
    resourceNames,
  });
}
