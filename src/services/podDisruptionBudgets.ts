import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { EventHandler, EventType } from '@/types/k8sEvent';

export interface PodDisruptionBudgetItem {
  name: string;
  namespace: string;
  min_available?: string;
  max_unavailable?: string;
  current_healthy?: number;
  desired_healthy?: number;
  disruptions_allowed?: number;
  status: string;
  creation_timestamp?: string;
}

export interface PodDisruptionBudgetEvent {
  type: EventType;
  object: PodDisruptionBudgetItem;
}

export async function listPodDisruptionBudgets({
  name,
  namespaces,
}: {
  name: string;
  namespaces?: string[];
}): Promise<PodDisruptionBudgetItem[]> {
  return await invoke('list_pod_disruption_budgets', { name, namespaces });
}

export async function watchPodDisruptionBudgets({
  name,
  namespaces,
  onEvent,
}: {
  name: string;
  namespaces?: string[];
  onEvent?: EventHandler<PodDisruptionBudgetEvent>;
}): Promise<{ eventName: string; unlisten: UnlistenFn }> {
  const eventName = await invoke<string>('watch_pod_disruption_budgets', { name, namespaces });
  const unlisten = await listen<PodDisruptionBudgetEvent>(eventName, (evt) => {
    try {
      onEvent?.(evt.payload);
    } catch (err) {
      console.error('Error in onEvent handler:', err);
    }
  });
  return { eventName, unlisten };
}
