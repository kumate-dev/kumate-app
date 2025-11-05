import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { V1Ingress } from '@kubernetes/client-node';
import { EventHandler, EventType } from '@/types/k8sEvent';
import { K8sResponse } from '@/types/k8sResponse';

export interface IngressEvent {
  type: EventType;
  object: V1Ingress;
}

export async function listIngresses({
  name,
  namespaces,
}: {
  name: string;
  namespaces?: string[];
}): Promise<V1Ingress[]> {
  return await invoke<V1Ingress[]>('list_ingresses', { name, namespaces });
}

export async function watchIngresses({
  name,
  namespaces,
  onEvent,
}: {
  name: string;
  namespaces?: string[];
  onEvent?: EventHandler<IngressEvent>;
}): Promise<{ eventName: string; unlisten: UnlistenFn }> {
  const eventName = await invoke<string>('watch_ingresses', { name, namespaces });
  const unlisten = await listen<IngressEvent>(eventName, (evt) => {
    try {
      onEvent?.(evt.payload);
    } catch (err) {
      console.error('Error in onEvent handler:', err);
    }
  });
  return { eventName, unlisten };
}

export async function createIngress({
  name,
  namespace,
  manifest,
}: {
  name: string;
  namespace?: string;
  manifest: V1Ingress;
}): Promise<V1Ingress> {
  return await invoke<V1Ingress>('create_ingress', { name, namespace, manifest });
}

export async function updateIngress({
  name,
  namespace,
  manifest,
}: {
  name: string;
  namespace?: string;
  manifest: V1Ingress;
}): Promise<V1Ingress> {
  return await invoke<V1Ingress>('update_ingress', { name, namespace, manifest });
}

export async function deleteIngresses({
  name,
  namespace,
  resourceNames,
}: {
  name: string;
  namespace?: string;
  resourceNames: string[];
}): Promise<K8sResponse[]> {
  return await invoke<K8sResponse[]>('delete_ingresses', { name, namespace, resourceNames });
}
