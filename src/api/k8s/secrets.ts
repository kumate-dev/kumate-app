import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { EventHandler, EventType } from '@/types/k8sEvent';
import type { V1Secret } from '@kubernetes/client-node';
import { K8sResponse } from '@/types/k8sResponse';

export interface SecretEvent {
  type: EventType;
  object: V1Secret;
}

export async function createSecret({
  name,
  namespace,
  manifest,
}: {
  name: string;
  namespace?: string;
  manifest: V1Secret;
}): Promise<V1Secret> {
  return await invoke<V1Secret>('create_secret', { name, namespace, manifest });
}

export async function updateSecret({
  name,
  namespace,
  manifest,
}: {
  name: string;
  namespace?: string;
  manifest: V1Secret;
}): Promise<V1Secret> {
  return await invoke<V1Secret>('update_secret', { name, namespace, manifest });
}

export async function listSecrets({
  name,
  namespaces,
}: {
  name: string;
  namespaces?: string[];
}): Promise<V1Secret[]> {
  return await invoke<V1Secret[]>('list_secrets', { name, namespaces });
}

export async function watchSecrets({
  name,
  namespaces,
  onEvent,
}: {
  name: string;
  namespaces?: string[];
  onEvent?: EventHandler<SecretEvent>;
}): Promise<{ eventName: string; unlisten: UnlistenFn }> {
  const eventName = await invoke<string>('watch_secrets', { name, namespaces });

  const unlisten = await listen<SecretEvent>(eventName, (evt) => {
    try {
      onEvent?.(evt.payload);
    } catch (err) {
      console.error('Error in onEvent handler:', err);
    }
  });

  return { eventName, unlisten };
}

export async function deleteSecrets({
  name,
  namespace,
  resourceNames,
}: {
  name: string;
  namespace?: string;
  resourceNames: string[];
}): Promise<K8sResponse[]> {
  return await invoke<K8sResponse[]>('delete_secrets', {
    name,
    namespace,
    resourceNames,
  });
}
