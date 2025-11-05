import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { V1ClusterRoleBinding } from '@kubernetes/client-node';
import { EventHandler, EventType } from '@/types/k8sEvent';
import { K8sResponse } from '@/types/k8sResponse';

export interface ClusterRoleBindingEvent {
  type: EventType;
  object: V1ClusterRoleBinding;
}

export async function listClusterRoleBindings({
  name,
}: {
  name: string;
}): Promise<V1ClusterRoleBinding[]> {
  return await invoke<V1ClusterRoleBinding[]>('list_cluster_role_bindings', { name });
}

export async function watchClusterRoleBindings({
  name,
  onEvent,
}: {
  name: string;
  onEvent?: EventHandler<ClusterRoleBindingEvent>;
}): Promise<{ eventName: string; unlisten: UnlistenFn }> {
  const eventName = await invoke<string>('watch_cluster_role_bindings', { name });

  const unlisten = await listen<ClusterRoleBindingEvent>(eventName, (evt) => {
    try {
      onEvent?.(evt.payload);
    } catch (err) {
      console.error('Error in onEvent handler:', err);
    }
  });

  return { eventName, unlisten };
}

export async function createClusterRoleBinding({
  name,
  manifest,
}: {
  name: string;
  manifest: V1ClusterRoleBinding;
}): Promise<V1ClusterRoleBinding> {
  return await invoke<V1ClusterRoleBinding>('create_cluster_role_binding', { name, manifest });
}

export async function updateClusterRoleBinding({
  name,
  manifest,
}: {
  name: string;
  manifest: V1ClusterRoleBinding;
}): Promise<V1ClusterRoleBinding> {
  return await invoke<V1ClusterRoleBinding>('update_cluster_role_binding', { name, manifest });
}

export async function deleteClusterRoleBindings({
  name,
  resourceNames,
}: {
  name: string;
  resourceNames: string[];
}): Promise<K8sResponse[]> {
  return await invoke<K8sResponse[]>('delete_cluster_role_bindings', { name, resourceNames });
}
