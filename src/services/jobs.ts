import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { EventHandler, EventType } from '../types/k8sEvent';

export interface JobItem {
  name: string;
  namespace: string;
  progress: string;
  creation_timestamp?: string;
}

export interface JobEvent {
  type: EventType;
  object: JobItem;
}

export async function listJobs({
  name,
  namespace,
}: {
  name: string;
  namespace?: string;
}): Promise<JobItem[]> {
  return await invoke<JobItem[]>('list_jobs', { name, namespace });
}

export async function watchJobs({
  name,
  namespace,
  onEvent,
}: {
  name: string;
  namespace?: string;
  onEvent?: EventHandler<JobEvent>;
}): Promise<{ eventName: string; unlisten: UnlistenFn }> {
  const eventName = await invoke<string>('watch_jobs', { name, namespace });
  const unlisten = await listen<JobEvent>(eventName, (evt) => {
    try {
      onEvent?.(evt.payload);
    } catch (err) {
      console.error('Error in onEvent handler:', err);
    }
  });
  return { eventName, unlisten };
}
