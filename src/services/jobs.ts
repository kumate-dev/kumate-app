import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { EventHandler, EventType } from '@/types/k8sEvent';
import type { V1Job } from '@kubernetes/client-node';
import { K8sResponse } from '@/types/k8sResponse';

export interface JobEvent {
  type: EventType;
  object: V1Job;
}

export async function listJobs({
  name,
  namespaces,
}: {
  name: string;
  namespaces?: string[];
}): Promise<V1Job[]> {
  return await invoke<V1Job[]>('list_jobs', { name, namespaces });
}

export async function watchJobs({
  name,
  namespaces,
  onEvent,
}: {
  name: string;
  namespaces?: string[];
  onEvent?: EventHandler<JobEvent>;
}): Promise<{ eventName: string; unlisten: UnlistenFn }> {
  const eventName = await invoke<string>('watch_jobs', { name, namespaces });

  const unlisten = await listen<JobEvent>(eventName, (evt) => {
    try {
      onEvent?.(evt.payload);
    } catch (err) {
      console.error('Error in onEvent handler:', err);
    }
  });

  return { eventName, unlisten };
}

export async function deleteJobs({
  name,
  namespace,
  resourceNames,
}: {
  name: string;
  namespace?: string;
  resourceNames: string[];
}): Promise<K8sResponse[]> {
  return await invoke<K8sResponse[]>('delete_jobs', {
    name,
    namespace,
    resourceNames,
  });
}
