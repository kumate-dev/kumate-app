import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { V1ValidatingWebhookConfiguration } from '@kubernetes/client-node';
import { EventHandler, EventType } from '@/types/k8sEvent';
import { K8sResponse } from '@/types/k8sResponse';

export interface ValidatingWebhookEvent {
  type: EventType;
  object: V1ValidatingWebhookConfiguration;
}

export async function listValidatingWebhooks({
  name,
}: {
  name: string;
}): Promise<V1ValidatingWebhookConfiguration[]> {
  return await invoke<V1ValidatingWebhookConfiguration[]>('list_validating_webhooks', { name });
}

export async function watchValidatingWebhooks({
  name,
  onEvent,
}: {
  name: string;
  onEvent?: EventHandler<ValidatingWebhookEvent>;
}): Promise<{ eventName: string; unlisten: UnlistenFn }> {
  const eventName = await invoke<string>('watch_validating_webhooks', { name });

  const unlisten = await listen<ValidatingWebhookEvent>(eventName, (evt) => {
    try {
      onEvent?.(evt.payload);
    } catch (err) {
      console.error('Error in onEvent handler:', err);
    }
  });

  return { eventName, unlisten };
}

export async function createValidatingWebhook({
  name,
  manifest,
}: {
  name: string;
  manifest: V1ValidatingWebhookConfiguration;
}): Promise<V1ValidatingWebhookConfiguration> {
  return await invoke<V1ValidatingWebhookConfiguration>('create_validating_webhook', {
    name,
    manifest,
  });
}

export async function updateValidatingWebhook({
  name,
  manifest,
}: {
  name: string;
  manifest: V1ValidatingWebhookConfiguration;
}): Promise<V1ValidatingWebhookConfiguration> {
  return await invoke<V1ValidatingWebhookConfiguration>('update_validating_webhook', {
    name,
    manifest,
  });
}

export async function deleteValidatingWebhooks({
  name,
  resourceNames,
}: {
  name: string;
  resourceNames: string[];
}): Promise<K8sResponse[]> {
  return await invoke<K8sResponse[]>('delete_validating_webhooks', { name, resourceNames });
}
