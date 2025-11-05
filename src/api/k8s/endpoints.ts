import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { V1Endpoints } from '@kubernetes/client-node';
import { EventHandler, EventType } from '@/types/k8sEvent';
import { K8sResponse } from '@/types/k8sResponse';

export interface EndpointsEvent {
  type: EventType;
  object: V1Endpoints;
}

export async function createEndpoints({
  name,
  namespace,
  manifest,
}: {
  name: string;
  namespace?: string;
  manifest: V1Endpoints;
}): Promise<V1Endpoints> {
  return invoke<V1Endpoints>('create_endpoints', { name, namespace, manifest });
}

export async function updateEndpoints({
  name,
  namespace,
  manifest,
}: {
  name: string;
  namespace?: string;
  manifest: V1Endpoints;
}): Promise<V1Endpoints> {
  return invoke<V1Endpoints>('update_endpoints', { name, namespace, manifest });
}

export async function listEndpoints({
  name,
  namespaces,
}: {
  name: string;
  namespaces?: string[];
}): Promise<V1Endpoints[]> {
  return await invoke<V1Endpoints[]>('list_endpoints', { name, namespaces });
}

export async function watchEndpoints({
  name,
  namespaces,
  onEvent,
}: {
  name: string;
  namespaces?: string[];
  onEvent?: EventHandler<EndpointsEvent>;
}): Promise<{ eventName: string; unlisten: UnlistenFn }> {
  const eventName = await invoke<string>('watch_endpoints', { name, namespaces });

  const unlisten = await listen<EndpointsEvent>(eventName, (evt) => {
    try {
      onEvent?.(evt.payload);
    } catch (err) {
      console.error('Error in onEvent handler:', err);
    }
  });

  return { eventName, unlisten };
}

export async function deleteEndpoints({
  name,
  namespace,
  resourceNames,
}: {
  name: string;
  namespace?: string;
  resourceNames: string[];
}): Promise<K8sResponse[]> {
  return await invoke<K8sResponse[]>('delete_endpoints', { name, namespace, resourceNames });
}
