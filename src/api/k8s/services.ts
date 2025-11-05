import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { EventHandler, EventType } from '@/types/k8sEvent';
import type { V1Service } from '@kubernetes/client-node';
import { K8sResponse } from '@/types/k8sResponse';

export interface ServiceEvent {
  type: EventType;
  object: V1Service;
}

export async function createService({
  name,
  namespace,
  manifest,
}: {
  name: string;
  namespace?: string;
  manifest: V1Service;
}): Promise<V1Service> {
  return await invoke<V1Service>('create_service', { name, namespace, manifest });
}

export async function updateService({
  name,
  namespace,
  manifest,
}: {
  name: string;
  namespace?: string;
  manifest: V1Service;
}): Promise<V1Service> {
  return await invoke<V1Service>('update_service', { name, namespace, manifest });
}

export async function listServices({
  name,
  namespaces,
}: {
  name: string;
  namespaces?: string[];
}): Promise<V1Service[]> {
  return await invoke<V1Service[]>('list_services', { name, namespaces });
}

export async function watchServices({
  name,
  namespaces,
  onEvent,
}: {
  name: string;
  namespaces?: string[];
  onEvent?: EventHandler<ServiceEvent>;
}): Promise<{ eventName: string; unlisten: UnlistenFn }> {
  const eventName = await invoke<string>('watch_services', { name, namespaces });
  const unlisten = await listen<ServiceEvent>(eventName, (evt) => {
    try {
      onEvent?.(evt.payload);
    } catch (err) {
      console.error('Error in onEvent handler:', err);
    }
  });

  return { eventName, unlisten };
}

export async function deleteServices({
  name,
  namespace,
  resourceNames,
}: {
  name: string;
  namespace?: string;
  resourceNames: string[];
}): Promise<K8sResponse[]> {
  return await invoke<K8sResponse[]>('delete_services', { name, namespace, resourceNames });
}