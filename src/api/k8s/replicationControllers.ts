import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { EventHandler, EventType } from '@/types/k8sEvent';
import type { V1ReplicationController } from '@kubernetes/client-node';
import { K8sResponse } from '@/types/k8sResponse';

export interface ReplicationControllerEvent {
  type: EventType;
  object: V1ReplicationController;
}

export async function createReplicationController({
  name,
  namespace,
  manifest,
}: {
  name: string;
  namespace?: string;
  manifest: V1ReplicationController;
}): Promise<V1ReplicationController> {
  return await invoke<V1ReplicationController>('create_replication_controller', {
    name,
    namespace,
    manifest,
  });
}

export async function updateReplicationController({
  name,
  namespace,
  manifest,
}: {
  name: string;
  namespace?: string;
  manifest: V1ReplicationController;
}): Promise<V1ReplicationController> {
  return await invoke<V1ReplicationController>('update_replication_controller', {
    name,
    namespace,
    manifest,
  });
}

export async function listReplicationControllers({
  name,
  namespaces,
}: {
  name: string;
  namespaces?: string[];
}): Promise<V1ReplicationController[]> {
  return await invoke<V1ReplicationController[]>('list_replication_controllers', {
    name,
    namespaces,
  });
}

export async function watchReplicationControllers({
  name,
  namespaces,
  onEvent,
}: {
  name: string;
  namespaces?: string[];
  onEvent?: EventHandler<ReplicationControllerEvent>;
}): Promise<{ eventName: string; unlisten: UnlistenFn }> {
  const eventName = await invoke<string>('watch_replication_controllers', { name, namespaces });

  const unlisten = await listen<ReplicationControllerEvent>(eventName, (evt) => {
    try {
      onEvent?.(evt.payload);
    } catch (err) {
      console.error('Error in onEvent handler:', err);
    }
  });

  return { eventName, unlisten };
}

export async function deleteReplicationControllers({
  name,
  namespace,
  resourceNames,
}: {
  name: string;
  namespace?: string;
  resourceNames: string[];
}): Promise<K8sResponse[]> {
  return await invoke<K8sResponse[]>('delete_replication_controllers', {
    name,
    namespace,
    resourceNames,
  });
}

export async function restartReplicationController({
  name,
  namespace,
  resourceName,
}: {
  name: string;
  namespace?: string;
  resourceName: string;
}): Promise<V1ReplicationController> {
  return await invoke<V1ReplicationController>('restart_replication_controller', {
    name,
    namespace,
    resourceName,
  });
}

export async function scaleReplicationController({
  name,
  namespace,
  resourceName,
  replicas,
}: {
  name: string;
  namespace?: string;
  resourceName: string;
  replicas: number;
}): Promise<V1ReplicationController> {
  return await invoke<V1ReplicationController>('scale_replication_controller', {
    name,
    namespace,
    resourceName,
    replicas,
  });
}
