import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { EventHandler, EventType } from '@/types/k8sEvent';
import type { V1ConfigMap } from '@kubernetes/client-node';
import { K8sResponse } from '@/types/k8sResponse';

export interface ConfigMapEvent {
  type: EventType;
  object: V1ConfigMap;
}

export async function createConfigMap({
  name,
  namespace,
  manifest,
}: {
  name: string;
  namespace?: string;
  manifest: V1ConfigMap;
}): Promise<V1ConfigMap> {
  return await invoke<V1ConfigMap>('create_config_map', { name, namespace, manifest });
}

export async function updateConfigMap({
  name,
  namespace,
  manifest,
}: {
  name: string;
  namespace?: string;
  manifest: V1ConfigMap;
}): Promise<V1ConfigMap> {
  return await invoke<V1ConfigMap>('update_config_map', { name, namespace, manifest });
}

export async function listConfigMaps({
  name,
  namespaces,
}: {
  name: string;
  namespaces?: string[];
}): Promise<V1ConfigMap[]> {
  return await invoke<V1ConfigMap[]>('list_config_maps', { name, namespaces });
}

export async function watchConfigMaps({
  name,
  namespaces,
  onEvent,
}: {
  name: string;
  namespaces?: string[];
  onEvent?: EventHandler<ConfigMapEvent>;
}): Promise<{ eventName: string; unlisten: UnlistenFn }> {
  const eventName = await invoke<string>('watch_config_maps', { name, namespaces });

  const unlisten = await listen<ConfigMapEvent>(eventName, (evt) => {
    try {
      onEvent?.(evt.payload);
    } catch (err) {
      console.error('Error in onEvent handler:', err);
    }
  });

  return { eventName, unlisten };
}

export async function deleteConfigMaps({
  name,
  namespace,
  resourceNames,
}: {
  name: string;
  namespace?: string;
  resourceNames: string[];
}): Promise<K8sResponse[]> {
  return await invoke<K8sResponse[]>('delete_config_maps', {
    name,
    namespace,
    resourceNames,
  });
}
