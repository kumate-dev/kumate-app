import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { V1ServiceAccount } from '@kubernetes/client-node';
import { EventHandler, EventType } from '@/types/k8sEvent';
import { K8sResponse } from '@/types/k8sResponse';

export interface ServiceAccountEvent {
  type: EventType;
  object: V1ServiceAccount;
}

export async function createServiceAccount({
  name,
  namespace,
  manifest,
}: {
  name: string;
  namespace?: string;
  manifest: V1ServiceAccount;
}): Promise<V1ServiceAccount> {
  return await invoke<V1ServiceAccount>('create_service_account', {
    name,
    namespace,
    manifest,
  });
}

export async function updateServiceAccount({
  name,
  namespace,
  manifest,
}: {
  name: string;
  namespace?: string;
  manifest: V1ServiceAccount;
}): Promise<V1ServiceAccount> {
  return await invoke<V1ServiceAccount>('update_service_account', {
    name,
    namespace,
    manifest,
  });
}

export async function listServiceAccounts({
  name,
  namespaces,
}: {
  name: string;
  namespaces?: string[];
}): Promise<V1ServiceAccount[]> {
  return await invoke<V1ServiceAccount[]>('list_service_accounts', {
    name,
    namespaces,
  });
}

export async function watchServiceAccounts({
  name,
  namespaces,
  onEvent,
}: {
  name: string;
  namespaces?: string[];
  onEvent?: EventHandler<ServiceAccountEvent>;
}): Promise<{ eventName: string; unlisten: UnlistenFn }> {
  const eventName = await invoke<string>('watch_service_accounts', { name, namespaces });

  const unlisten = await listen<ServiceAccountEvent>(eventName, (evt) => {
    try {
      onEvent?.(evt.payload);
    } catch (err) {
      console.error('Error in onEvent handler:', err);
    }
  });

  return { eventName, unlisten };
}

export async function deleteServiceAccounts({
  name,
  namespace,
  resourceNames,
}: {
  name: string;
  namespace?: string;
  resourceNames: string[];
}): Promise<K8sResponse[]> {
  return await invoke<K8sResponse[]>('delete_service_accounts', {
    name,
    namespace,
    resourceNames,
  });
}
