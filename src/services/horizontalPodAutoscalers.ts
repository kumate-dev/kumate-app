import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { EventHandler, EventType } from '@/types/k8sEvent';

export interface HorizontalPodAutoscalerItem {
  name: string;
  namespace: string;
  min_replicas?: number;
  max_replicas: number;
  current_replicas?: number;
  desired_replicas?: number;
  target_ref: string;
  status: string;
  creation_timestamp?: string;
}

export interface HorizontalPodAutoscalerEvent {
  type: EventType;
  object: HorizontalPodAutoscalerItem;
}

export async function listHorizontalPodAutoscalers({
  name,
  namespaces,
}: {
  name: string;
  namespaces?: string[];
}): Promise<HorizontalPodAutoscalerItem[]> {
  return await invoke<HorizontalPodAutoscalerItem[]>('list_horizontal_pod_autoscalers', {
    name,
    namespaces,
  });
}

export async function watchHorizontalPodAutoscalers({
  name,
  namespaces,
  onEvent,
}: {
  name: string;
  namespaces?: string[];
  onEvent?: EventHandler<HorizontalPodAutoscalerEvent>;
}): Promise<{ eventName: string; unlisten: UnlistenFn }> {
  const eventName = await invoke<string>('watch_horizontal_pod_autoscalers', { name, namespaces });

  const unlisten = await listen<HorizontalPodAutoscalerEvent>(eventName, (evt) => {
    try {
      onEvent?.(evt.payload);
    } catch (err) {
      console.error('Error in onEvent handler:', err);
    }
  });

  return { eventName, unlisten };
}
