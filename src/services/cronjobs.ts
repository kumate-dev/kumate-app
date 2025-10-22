import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { EventHandler, EventType } from '@/types/k8sEvent';

export interface CronJobItem {
  name: string;
  namespace: string;
  schedule: string;
  suspend: boolean;
  last_schedule?: string;
  creation_timestamp?: string;
}

export interface CronJobEvent {
  type: EventType;
  object: CronJobItem;
}

export async function listCronJobs({
  name,
  namespaces,
}: {
  name: string;
  namespaces?: string[];
}): Promise<CronJobItem[]> {
  return await invoke<CronJobItem[]>('list_cronjobs', { name, namespaces });
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
  const eventName = await invoke<string>('watch_cronjobs', { name, namespaces });

  const unlisten = await listen<CronJobEvent>(eventName, (evt) => {
    try {
      onEvent?.(evt.payload);
    } catch (err) {
      console.error('Error in onEvent handler:', err);
    }
  });

  return { eventName, unlisten };
}
