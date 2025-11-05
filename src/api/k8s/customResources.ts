import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { EventType, EventHandler } from '@/types/k8sEvent';
import { K8sResponse } from '@/types/k8sResponse';

export type CrdIdentity = {
  group: string;
  version: string;
  kind: string;
  plural: string;
  isNamespaced: boolean;
};

export interface CustomResourceEvent {
  type: EventType;
  object: Record<string, any>;
}

export async function createCustomResource({
  name,
  namespace,
  manifest,
  crd,
}: {
  name: string;
  namespace?: string;
  manifest: Record<string, any>;
  crd: CrdIdentity;
}): Promise<Record<string, any>> {
  const { group, version, kind, plural, isNamespaced } = crd;
  return await invoke<Record<string, any>>('create_custom_resource', {
    name,
    namespace,
    group,
    version,
    kind,
    plural,
    isNamespaced,
    manifest,
  });
}

export async function updateCustomResource({
  name,
  namespace,
  manifest,
  crd,
}: {
  name: string;
  namespace?: string;
  manifest: Record<string, any>;
  crd: CrdIdentity;
}): Promise<Record<string, any>> {
  const { group, version, kind, plural, isNamespaced } = crd;
  return await invoke<Record<string, any>>('update_custom_resource', {
    name,
    namespace,
    group,
    version,
    kind,
    plural,
    isNamespaced,
    manifest,
  });
}

export async function listCustomResources({
  name,
  namespaces,
  crd,
}: {
  name: string;
  namespaces?: string[];
  crd: CrdIdentity;
}): Promise<Record<string, any>[]> {
  const { group, version, kind, plural, isNamespaced } = crd;
  return await invoke<Record<string, any>[]>('list_custom_resources', {
    name,
    namespaces,
    group,
    version,
    kind,
    plural,
    isNamespaced,
  });
}

export async function watchCustomResources({
  name,
  namespaces,
  crd,
  onEvent,
}: {
  name: string;
  namespaces?: string[];
  crd: CrdIdentity;
  onEvent?: EventHandler<CustomResourceEvent>;
}): Promise<{ eventName: string; unlisten: UnlistenFn }> {
  const { group, version, kind, plural, isNamespaced } = crd;
  const eventName = await invoke<string>('watch_custom_resources', {
    name,
    namespaces,
    group,
    version,
    kind,
    plural,
    isNamespaced,
  });
  const unlisten = await listen<CustomResourceEvent>(eventName, (evt) => {
    try {
      onEvent?.(evt.payload);
    } catch (err) {
      console.error('Error in onEvent handler:', err);
    }
  });
  return { eventName, unlisten };
}

export async function deleteCustomResources({
  name,
  namespace,
  resourceNames,
  crd,
}: {
  name: string;
  namespace?: string;
  resourceNames: string[];
  crd: CrdIdentity;
}): Promise<K8sResponse[]> {
  const { group, version, kind, plural, isNamespaced } = crd;
  return await invoke<K8sResponse[]>('delete_custom_resources', {
    name,
    namespace,
    group,
    version,
    kind,
    plural,
    isNamespaced,
    resourceNames,
  });
}
