import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { V1IngressClass } from '@kubernetes/client-node';
import { EventHandler, EventType } from '@/types/k8sEvent';
import { K8sResponse } from '@/types/k8sResponse';

export interface IngressClassEvent {
  type: EventType;
  object: V1IngressClass;
}

export async function listIngressClasses({ name }: { name: string }): Promise<V1IngressClass[]> {
  return await invoke<V1IngressClass[]>('list_ingress_classes', { name });
}

export async function watchIngressClasses({
  name,
  onEvent,
}: {
  name: string;
  onEvent?: EventHandler<IngressClassEvent>;
}): Promise<{ eventName: string; unlisten: UnlistenFn }> {
  const eventName = await invoke<string>('watch_ingress_classes', { name });
  const unlisten = await listen<IngressClassEvent>(eventName, (evt) => {
    try {
      onEvent?.(evt.payload);
    } catch (err) {
      console.error('Error in onEvent handler:', err);
    }
  });
  return { eventName, unlisten };
}

export async function createIngressClass({
  name,
  manifest,
}: {
  name: string;
  manifest: V1IngressClass;
}): Promise<V1IngressClass> {
  return await invoke<V1IngressClass>('create_ingress_class', { name, manifest });
}

export async function updateIngressClass({
  name,
  manifest,
}: {
  name: string;
  manifest: V1IngressClass;
}): Promise<V1IngressClass> {
  return await invoke<V1IngressClass>('update_ingress_class', { name, manifest });
}

export async function deleteIngressClasses({
  name,
  resourceNames,
}: {
  name: string;
  resourceNames: string[];
}): Promise<K8sResponse[]> {
  return await invoke<K8sResponse[]>('delete_ingress_classes', { name, resourceNames });
}
