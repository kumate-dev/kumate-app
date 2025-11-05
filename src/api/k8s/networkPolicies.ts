import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { V1NetworkPolicy } from '@kubernetes/client-node';
import { EventHandler, EventType } from '@/types/k8sEvent';
import { K8sResponse } from '@/types/k8sResponse';

export interface NetworkPolicyEvent {
  type: EventType;
  object: V1NetworkPolicy;
}

export async function createNetworkPolicy({
  name,
  namespace,
  manifest,
}: {
  name: string;
  namespace?: string;
  manifest: V1NetworkPolicy;
}): Promise<V1NetworkPolicy> {
  return invoke<V1NetworkPolicy>('create_network_policy', { name, namespace, manifest });
}

export async function updateNetworkPolicy({
  name,
  namespace,
  manifest,
}: {
  name: string;
  namespace?: string;
  manifest: V1NetworkPolicy;
}): Promise<V1NetworkPolicy> {
  return invoke<V1NetworkPolicy>('update_network_policy', { name, namespace, manifest });
}

export async function listNetworkPolicies({
  name,
  namespaces,
}: {
  name: string;
  namespaces?: string[];
}): Promise<V1NetworkPolicy[]> {
  return await invoke<V1NetworkPolicy[]>('list_network_policies', { name, namespaces });
}

export async function watchNetworkPolicies({
  name,
  namespaces,
  onEvent,
}: {
  name: string;
  namespaces?: string[];
  onEvent?: EventHandler<NetworkPolicyEvent>;
}): Promise<{ eventName: string; unlisten: UnlistenFn }> {
  const eventName = await invoke<string>('watch_network_policies', { name, namespaces });

  const unlisten = await listen<NetworkPolicyEvent>(eventName, (evt) => {
    try {
      onEvent?.(evt.payload);
    } catch (err) {
      console.error('Error in onEvent handler:', err);
    }
  });

  return { eventName, unlisten };
}

export async function deleteNetworkPolicies({
  name,
  namespace,
  resourceNames,
}: {
  name: string;
  namespace?: string;
  resourceNames: string[];
}): Promise<K8sResponse[]> {
  return await invoke<K8sResponse[]>('delete_network_policies', { name, namespace, resourceNames });
}
