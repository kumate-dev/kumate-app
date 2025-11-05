import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { V1Lease } from '@kubernetes/client-node';
import { EventHandler, EventType } from '@/types/k8sEvent';
import { K8sResponse } from '@/types/k8sResponse';

export interface LeaseEvent {
  type: EventType;
  object: V1Lease;
}

export async function createLease({
  name,
  namespace,
  manifest,
}: {
  name: string;
  namespace?: string;
  manifest: V1Lease;
}): Promise<V1Lease> {
  return await invoke<V1Lease>('create_lease', { name, namespace, manifest });
}

export async function updateLease({
  name,
  namespace,
  manifest,
}: {
  name: string;
  namespace?: string;
  manifest: V1Lease;
}): Promise<V1Lease> {
  return await invoke<V1Lease>('update_lease', { name, namespace, manifest });
}

export async function listLeases({
  name,
  namespaces,
}: {
  name: string;
  namespaces?: string[];
}): Promise<V1Lease[]> {
  return await invoke<V1Lease[]>('list_leases', { name, namespaces });
}

export async function watchLeases({
  name,
  namespaces,
  onEvent,
}: {
  name: string;
  namespaces?: string[];
  onEvent?: EventHandler<LeaseEvent>;
}): Promise<{ eventName: string; unlisten: UnlistenFn }> {
  const eventName = await invoke<string>('watch_leases', { name, namespaces });
  const unlisten = await listen<LeaseEvent>(eventName, (evt) => {
    try {
      onEvent?.(evt.payload);
    } catch (err) {
      console.error('Error in onEvent handler:', err);
    }
  });

  return { eventName, unlisten };
}

export async function deleteLeases({
  name,
  namespace,
  resourceNames,
}: {
  name: string;
  namespace?: string;
  resourceNames: string[];
}): Promise<K8sResponse[]> {
  return await invoke<K8sResponse[]>('delete_leases', { name, namespace, resourceNames });
}
