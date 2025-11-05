import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { V1ClusterRole } from '@kubernetes/client-node';
import { EventHandler, EventType } from '@/types/k8sEvent';
import { K8sResponse } from '@/types/k8sResponse';

export interface ClusterRoleEvent {
  type: EventType;
  object: V1ClusterRole;
}

export async function listClusterRoles({ name }: { name: string }): Promise<V1ClusterRole[]> {
  return await invoke<V1ClusterRole[]>('list_cluster_roles', { name });
}

export async function watchClusterRoles({
  name,
  onEvent,
}: {
  name: string;
  onEvent?: EventHandler<ClusterRoleEvent>;
}): Promise<{ eventName: string; unlisten: UnlistenFn }> {
  const eventName = await invoke<string>('watch_cluster_roles', { name });

  const unlisten = await listen<ClusterRoleEvent>(eventName, (evt) => {
    try {
      onEvent?.(evt.payload);
    } catch (err) {
      console.error('Error in onEvent handler:', err);
    }
  });

  return { eventName, unlisten };
}

export async function createClusterRole({
  name,
  manifest,
}: {
  name: string;
  manifest: V1ClusterRole;
}): Promise<V1ClusterRole> {
  return await invoke<V1ClusterRole>('create_cluster_role', { name, manifest });
}

export async function updateClusterRole({
  name,
  manifest,
}: {
  name: string;
  manifest: V1ClusterRole;
}): Promise<V1ClusterRole> {
  return await invoke<V1ClusterRole>('update_cluster_role', { name, manifest });
}

export async function deleteClusterRoles({
  name,
  resourceNames,
}: {
  name: string;
  resourceNames: string[];
}): Promise<K8sResponse[]> {
  return await invoke<K8sResponse[]>('delete_cluster_roles', { name, resourceNames });
}