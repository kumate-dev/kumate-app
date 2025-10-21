import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { EventHandler, EventType } from '../types/k8sEvent';

export interface DeploymentItem {
  name: string;
  namespace: string;
  ready: string;
  creation_timestamp?: string;
  status?: string;
}

export interface DeploymentEvent {
  type: EventType;
  object: DeploymentItem;
}

export async function listDeployments({
  name,
  namespace,
}: {
  name: string;
  namespace?: string;
}): Promise<DeploymentItem[]> {
  return await invoke<DeploymentItem[]>('list_deployments', { name, namespace });
}

export async function watchDeployments({
  name,
  namespace,
  onEvent,
}: {
  name: string;
  namespace?: string;
  onEvent?: EventHandler<DeploymentEvent>;
}): Promise<{ eventName: string; unlisten: UnlistenFn }> {
  const eventName = await invoke<string>('watch_deployments', { name, namespace });
  const unlisten = await listen<DeploymentEvent>(eventName, (evt) => {
    try {
      onEvent?.(evt.payload);
    } catch (err) {
      console.error('Error in onEvent handler:', err);
    }
  });
  return { eventName, unlisten };
}
