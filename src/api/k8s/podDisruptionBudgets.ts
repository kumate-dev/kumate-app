import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { EventHandler, EventType } from '@/types/k8sEvent';
import type { V1PodDisruptionBudget } from '@kubernetes/client-node';
import { K8sResponse } from '@/types/k8sResponse';

export interface PodDisruptionBudgetEvent {
  type: EventType;
  object: V1PodDisruptionBudget;
}

export async function createPodDisruptionBudget({
  name,
  namespace,
  manifest,
}: {
  name: string;
  namespace?: string;
  manifest: V1PodDisruptionBudget;
}): Promise<V1PodDisruptionBudget> {
  return await invoke<V1PodDisruptionBudget>('create_pod_disruption_budget', {
    name,
    namespace,
    manifest,
  });
}

export async function updatePodDisruptionBudget({
  name,
  namespace,
  manifest,
}: {
  name: string;
  namespace?: string;
  manifest: V1PodDisruptionBudget;
}): Promise<V1PodDisruptionBudget> {
  return await invoke<V1PodDisruptionBudget>('update_pod_disruption_budget', {
    name,
    namespace,
    manifest,
  });
}

export async function listPodDisruptionBudgets({
  name,
  namespaces,
}: {
  name: string;
  namespaces?: string[];
}): Promise<V1PodDisruptionBudget[]> {
  return await invoke<V1PodDisruptionBudget[]>('list_pod_disruption_budgets', { name, namespaces });
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

export async function deletePodDisruptionBudgets({
  name,
  namespace,
  resourceNames,
}: {
  name: string;
  namespace?: string;
  resourceNames: string[];
}): Promise<K8sResponse[]> {
  return await invoke<K8sResponse[]>('delete_pod_disruption_budgets', {
    name,
    namespace,
    resourceNames,
  });
}
