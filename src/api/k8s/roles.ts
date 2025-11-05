import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { V1Role } from '@kubernetes/client-node';
import { EventHandler, EventType } from '@/types/k8sEvent';
import { K8sResponse } from '@/types/k8sResponse';

export interface RoleEvent {
  type: EventType;
  object: V1Role;
}

export async function createRole({
  name,
  namespace,
  manifest,
}: {
  name: string;
  namespace?: string;
  manifest: V1Role;
}): Promise<V1Role> {
  return await invoke<V1Role>('create_role', {
    name,
    namespace,
    manifest,
  });
}

export async function updateRole({
  name,
  namespace,
  manifest,
}: {
  name: string;
  namespace?: string;
  manifest: V1Role;
}): Promise<V1Role> {
  return await invoke<V1Role>('update_role', {
    name,
    namespace,
    manifest,
  });
}

export async function listRoles({
  name,
  namespaces,
}: {
  name: string;
  namespaces?: string[];
}): Promise<V1Role[]> {
  return await invoke<V1Role[]>('list_roles', {
    name,
    namespaces,
  });
}

export async function watchRoles({
  name,
  namespaces,
  onEvent,
}: {
  name: string;
  namespaces?: string[];
  onEvent?: EventHandler<RoleEvent>;
}): Promise<{ eventName: string; unlisten: UnlistenFn }> {
  const eventName = await invoke<string>('watch_roles', { name, namespaces });

  const unlisten = await listen<RoleEvent>(eventName, (evt) => {
    try {
      onEvent?.(evt.payload);
    } catch (err) {
      console.error('Error in onEvent handler:', err);
    }
  });

  return { eventName, unlisten };
}

export async function deleteRoles({
  name,
  namespace,
  resourceNames,
}: {
  name: string;
  namespace?: string;
  resourceNames: string[];
}): Promise<K8sResponse[]> {
  return await invoke<K8sResponse[]>('delete_roles', {
    name,
    namespace,
    resourceNames,
  });
}