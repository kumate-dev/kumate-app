import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { V1MutatingWebhookConfiguration } from '@kubernetes/client-node';
import { EventHandler, EventType } from '@/types/k8sEvent';
import { K8sResponse } from '@/types/k8sResponse';

export interface MutatingWebhookEvent {
  type: EventType;
  object: V1MutatingWebhookConfiguration;
}

export async function listMutatingWebhooks({
  name,
}: {
  name: string;
}): Promise<V1MutatingWebhookConfiguration[]> {
  return await invoke<V1MutatingWebhookConfiguration[]>('list_mutating_webhooks', { name });
}

export async function watchMutatingWebhooks({
  name,
  onEvent,
}: {
  name: string;
  onEvent?: EventHandler<MutatingWebhookEvent>;
}): Promise<{ eventName: string; unlisten: UnlistenFn }> {
  const eventName = await invoke<string>('watch_mutating_webhooks', { name });

  const unlisten = await listen<MutatingWebhookEvent>(eventName, (evt) => {
    try {
      onEvent?.(evt.payload);
    } catch (err) {
      console.error('Error in onEvent handler:', err);
    }
  });

  return { eventName, unlisten };
}

export async function createMutatingWebhook({
  name,
  manifest,
}: {
  name: string;
  manifest: V1MutatingWebhookConfiguration;
}): Promise<V1MutatingWebhookConfiguration> {
  return await invoke<V1MutatingWebhookConfiguration>('create_mutating_webhook', {
    name,
    manifest,
  });
}

export async function updateMutatingWebhook({
  name,
  manifest,
}: {
  name: string;
  manifest: V1MutatingWebhookConfiguration;
}): Promise<V1MutatingWebhookConfiguration> {
  return await invoke<V1MutatingWebhookConfiguration>('update_mutating_webhook', {
    name,
    manifest,
  });
}

export async function deleteMutatingWebhooks({
  name,
  resourceNames,
}: {
  name: string;
  resourceNames: string[];
}): Promise<K8sResponse[]> {
  return await invoke<K8sResponse[]>('delete_mutating_webhooks', { name, resourceNames });
}
