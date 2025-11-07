import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { EventHandler, EventType } from '@/types/k8sEvent';
import type { V1CronJob } from '@kubernetes/client-node';
import { K8sResponse } from '@/types/k8sResponse';

export interface CronJobEvent {
  type: EventType;
  object: V1CronJob;
}

export async function createCronJob({
  name,
  namespace,
  manifest,
}: {
  name: string;
  namespace?: string;
  manifest: V1CronJob;
}): Promise<V1CronJob> {
  return await invoke<V1CronJob>('create_cron_job', { name, namespace, manifest });
}

export async function updateCronJob({
  name,
  namespace,
  manifest,
}: {
  name: string;
  namespace?: string;
  manifest: V1CronJob;
}): Promise<V1CronJob> {
  return await invoke<V1CronJob>('update_cron_job', { name, namespace, manifest });
}

export async function listCronJobs({
  name,
  namespaces,
}: {
  name: string;
  namespaces?: string[];
}): Promise<V1CronJob[]> {
  return await invoke<V1CronJob[]>('list_cron_jobs', { name, namespaces });
}

export async function watchCronJobs({
  name,
  namespaces,
  onEvent,
}: {
  name: string;
  namespaces?: string[];
  onEvent?: EventHandler<CronJobEvent>;
}): Promise<{ eventName: string; unlisten: UnlistenFn }> {
  const eventName = await invoke<string>('watch_cron_jobs', { name, namespaces });

  const unlisten = await listen<CronJobEvent>(eventName, (evt) => {
    try {
      onEvent?.(evt.payload);
    } catch (err) {
      console.error('Error in onEvent handler:', err);
    }
  });

  return { eventName, unlisten };
}

export async function deleteCronJobs({
  name,
  namespace,
  resourceNames,
}: {
  name: string;
  namespace?: string;
  resourceNames: string[];
}): Promise<K8sResponse[]> {
  return await invoke<K8sResponse[]>('delete_cron_jobs', {
    name,
    namespace,
    resourceNames,
  });
}

export async function suspendCronJob({
  name,
  namespace,
  resourceName,
  suspend,
}: {
  name: string;
  namespace?: string;
  resourceName: string;
  suspend: boolean;
}): Promise<V1CronJob> {
  return await invoke<V1CronJob>('suspend_cron_job', {
    name,
    namespace,
    resourceName,
    suspend,
  });
}
