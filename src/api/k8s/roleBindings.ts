import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { V1RoleBinding } from '@kubernetes/client-node';
import { EventHandler, EventType } from '@/types/k8sEvent';
import { K8sResponse } from '@/types/k8sResponse';

export interface RoleBindingEvent {
  type: EventType;
  object: V1RoleBinding;
}

export async function createRoleBinding({
  name,
  namespace,
  manifest,
}: {
  name: string;
  namespace?: string;
  manifest: V1RoleBinding;
}): Promise<V1RoleBinding> {
  return await invoke<V1RoleBinding>('create_role_binding', {
    name,
    namespace,
    manifest,
  });
}

export async function updateRoleBinding({
  name,
  namespace,
  manifest,
}: {
  name: string;
  namespace?: string;
  manifest: V1RoleBinding;
}): Promise<V1RoleBinding> {
  return await invoke<V1RoleBinding>('update_role_binding', {
    name,
    namespace,
    manifest,
  });
}

export async function listRoleBindings({
  name,
  namespaces,
}: {
  name: string;
  namespaces?: string[];
}): Promise<V1RoleBinding[]> {
  return await invoke<V1RoleBinding[]>('list_role_bindings', {
    name,
    namespaces,
  });
}

export async function watchRoleBindings({
  name,
  namespaces,
  onEvent,
}: {
  name: string;
  namespaces?: string[];
  onEvent?: EventHandler<RoleBindingEvent>;
}): Promise<{ eventName: string; unlisten: UnlistenFn }> {
  const eventName = await invoke<string>('watch_role_bindings', { name, namespaces });

  const unlisten = await listen<RoleBindingEvent>(eventName, (evt) => {
    try {
      onEvent?.(evt.payload);
    } catch (err) {
      console.error('Error in onEvent handler:', err);
    }
  });

  return { eventName, unlisten };
}

export async function deleteRoleBindings({
  name,
  namespace,
  resourceNames,
}: {
  name: string;
  namespace?: string;
  resourceNames: string[];
}): Promise<K8sResponse[]> {
  return await invoke<K8sResponse[]>('delete_role_bindings', {
    name,
    namespace,
    resourceNames,
  });
}
