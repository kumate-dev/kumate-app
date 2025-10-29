import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { EventHandler, EventType } from '@/types/k8sEvent';
import type { V1ReplicaSet } from '@kubernetes/client-node';
import { K8sResponse } from '@/types/k8sResponse';

export interface ReplicaSetEvent {
  type: EventType;
  object: V1ReplicaSet;
}

export async function listReplicaSets({
  name,
  namespaces,
}: {
  name: string;
  namespaces?: string[];
}): Promise<V1ReplicaSet[]> {
  return await invoke<V1ReplicaSet[]>('list_replica_sets', { name, namespaces });
}

export async function watchReplicaSets({
  name,
  namespaces,
  onEvent,
}: {
  name: string;
  namespaces?: string[];
  onEvent?: EventHandler<ReplicaSetEvent>;
}): Promise<{ eventName: string; unlisten: UnlistenFn }> {
  const eventName = await invoke<string>('watch_replica_sets', { name, namespaces });

  const unlisten = await listen<ReplicaSetEvent>(eventName, (evt) => {
    try {
      onEvent?.(evt.payload);
    } catch (err) {
      console.error('Error in onEvent handler:', err);
    }
  });

  return { eventName, unlisten };
}

export async function deleteReplicaSets({
  name,
  namespace,
  resourceNames,
}: {
  name: string;
  namespace?: string;
  resourceNames: string[];
}): Promise<K8sResponse[]> {
  return await invoke<K8sResponse[]>('delete_replica_sets', {
    name,
    namespace,
    resourceNames,
  });
}
