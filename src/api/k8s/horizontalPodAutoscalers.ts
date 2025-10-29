import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { EventHandler, EventType } from '@/types/k8sEvent';
import type { V1HorizontalPodAutoscaler } from '@kubernetes/client-node';
import { K8sResponse } from '@/types/k8sResponse';

export interface HorizontalPodAutoscalerEvent {
  type: EventType;
  object: V1HorizontalPodAutoscaler;
}

export async function listHorizontalPodAutoscalers({
  name,
  namespaces,
}: {
  name: string;
  namespaces?: string[];
}): Promise<V1HorizontalPodAutoscaler[]> {
  return await invoke<V1HorizontalPodAutoscaler[]>('list_horizontal_pod_autoscalers', {
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

export async function deleteHorizontalPodAutoscalers({
  name,
  namespace,
  resourceNames,
}: {
  name: string;
  namespace?: string;
  resourceNames: string[];
}): Promise<K8sResponse[]> {
  return await invoke<K8sResponse[]>('delete_horizontal_pod_autoscalers', {
    name,
    namespace,
    resourceNames,
  });
}
