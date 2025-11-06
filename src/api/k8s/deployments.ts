import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { EventHandler, EventType } from '@/types/k8sEvent';
import { K8sResponse } from '@/types/k8sResponse';
import type { V1Deployment } from '@kubernetes/client-node';

export interface DeploymentEvent {
  type: EventType;
  object: V1Deployment;
}

export async function createDeployment({
  name,
  namespace,
  manifest,
}: {
  name: string;
  namespace?: string;
  manifest: V1Deployment;
}): Promise<V1Deployment> {
  return await invoke<V1Deployment>('create_deployment', { name, namespace, manifest });
}

export async function updateDeployment({
  name,
  namespace,
  manifest,
}: {
  name: string;
  namespace?: string;
  manifest: V1Deployment;
}): Promise<V1Deployment> {
  return await invoke<V1Deployment>('update_deployment', { name, namespace, manifest });
}

export async function listDeployments({
  name,
  namespaces,
}: {
  name: string;
  namespaces?: string[];
}): Promise<V1Deployment[]> {
  return await invoke<V1Deployment[]>('list_deployments', { name, namespaces });
}

export async function watchDeployments({
  name,
  namespaces,
  onEvent,
}: {
  name: string;
  namespaces?: string[];
  onEvent?: EventHandler<DeploymentEvent>;
}): Promise<{ eventName: string; unlisten: UnlistenFn }> {
  const eventName = await invoke<string>('watch_deployments', { name, namespaces });

  const unlisten = await listen<DeploymentEvent>(eventName, (evt) => {
    try {
      onEvent?.(evt.payload);
    } catch (err) {
      console.error('Error in onEvent handler:', err);
    }
  });

  return { eventName, unlisten };
}

export async function deleteDeployments({
  name,
  namespace,
  resourceNames,
}: {
  name: string;
  namespace?: string;
  resourceNames: string[];
}): Promise<K8sResponse[]> {
  return await invoke<K8sResponse[]>('delete_deployments', { name, namespace, resourceNames });
}

export async function restartDeployment({
  name,
  namespace,
  resourceName,
}: {
  name: string;
  namespace?: string;
  resourceName: string;
}): Promise<V1Deployment> {
  return await invoke<V1Deployment>('restart_deployment', { name, namespace, resourceName });
}

export async function scaleDeployment({
  name,
  namespace,
  resourceName,
  replicas,
}: {
  name: string;
  namespace?: string;
  resourceName: string;
  replicas: number;
}): Promise<V1Deployment> {
  return await invoke<V1Deployment>('scale_deployment', {
    name,
    namespace,
    resourceName,
    replicas,
  });
}
