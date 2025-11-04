import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { EventHandler, EventType } from '@/types/k8sEvent';
import { K8sResponse } from '@/types/k8sResponse';
import type { V1Pod } from '@kubernetes/client-node';

export interface PodEvent {
  type: EventType;
  object: V1Pod;
}

export interface LogEvent {
  type: 'LOG_LINE' | 'LOG_ERROR' | 'LOG_COMPLETED';
  pod: string;
  namespace: string;
  container?: string;
  log?: string;
  error?: string;
  timestamp: string;
}

export async function createPod({
  name,
  namespace,
  manifest,
}: {
  name: string;
  namespace?: string;
  manifest: V1Pod;
}): Promise<V1Pod> {
  return await invoke<V1Pod>('create_pod', { name, namespace, manifest });
}

export async function updatePod({
  name,
  namespace,
  manifest,
}: {
  name: string;
  namespace?: string;
  manifest: V1Pod;
}): Promise<V1Pod> {
  return await invoke<V1Pod>('update_pod', { name, namespace, manifest });
}

export async function listPods({
  name,
  namespaces,
}: {
  name: string;
  namespaces?: string[];
}): Promise<V1Pod[]> {
  return await invoke<V1Pod[]>('list_pods', { name, namespaces });
}

export async function watchPods({
  name,
  namespaces,
  onEvent,
}: {
  name: string;
  namespaces?: string[];
  onEvent?: EventHandler<PodEvent>;
}): Promise<{ eventName: string; unlisten: UnlistenFn }> {
  const eventName = await invoke<string>('watch_pods', { name, namespaces });

  const unlisten = await listen<PodEvent>(eventName, (evt) => {
    try {
      onEvent?.(evt.payload);
    } catch (err) {
      console.error('Error in onEvent handler:', err);
    }
  });

  return { eventName, unlisten };
}

export async function deletePods({
  name,
  namespace,
  resourceNames,
}: {
  name: string;
  namespace?: string;
  resourceNames: string[];
}): Promise<K8sResponse[]> {
  return await invoke<K8sResponse[]>('delete_pods', { name, namespace, resourceNames });
}

export async function getPodLogs({
  context,
  namespace,
  podName,
  containerName,
  tailLines,
}: {
  context: string;
  namespace: string;
  podName: string;
  containerName?: string;
  tailLines?: number;
}): Promise<string> {
  return await invoke<string>('get_pod_logs', {
    context,
    namespace,
    podName,
    containerName,
    tailLines,
  });
}

export async function watchPodLogs({
  context,
  namespace,
  podName,
  containerName,
  tailLines,
  onEvent,
}: {
  context: string;
  namespace: string;
  podName: string;
  containerName?: string;
  tailLines?: number;
  onEvent?: EventHandler<LogEvent>;
}): Promise<{ eventName: string; unlisten: UnlistenFn }> {
  const eventName = await invoke<string>('watch_pod_logs', {
    context,
    namespace,
    podName,
    containerName,
    tailLines,
  });

  const unlisten = await listen<LogEvent>(eventName, (evt) => {
    try {
      onEvent?.(evt.payload);
    } catch (err) {
      console.error('Error in log event handler:', err);
    }
  });

  return { eventName, unlisten };
}

export async function execPod({
  context,
  namespace,
  podName,
  containerName,
  command,
  tty,
}: {
  context: string;
  namespace: string;
  podName: string;
  containerName?: string;
  command: string[];
  tty?: boolean;
}): Promise<string> {
  return await invoke<string>('exec_pod', {
    context,
    namespace,
    podName,
    containerName,
    command,
    tty,
  });
}

export interface ExecEvent {
  type: 'EXEC_STDOUT' | 'EXEC_STDERR' | 'EXEC_ERROR' | 'EXEC_COMPLETED';
  pod: string;
  namespace: string;
  container?: string;
  data?: string;
  error?: string;
  timestamp: string;
}

export async function startExecPodSession({
  context,
  namespace,
  podName,
  containerName,
  command,
  tty,
  onEvent,
}: {
  context: string;
  namespace: string;
  podName: string;
  containerName?: string;
  command?: string[];
  tty?: boolean;
  onEvent?: EventHandler<ExecEvent>;
}): Promise<{ eventName: string; sessionId: string; unlisten: UnlistenFn }> {
  const { event_name, session_id } = await invoke<{ event_name: string; session_id: string }>(
    'start_exec_pod',
    { context, namespace, podName, containerName, command, tty }
  );

  const unlisten = await listen<ExecEvent>(event_name, (evt) => {
    try {
      onEvent?.(evt.payload);
    } catch (err) {
      console.error('Error in exec event handler:', err);
    }
  });

  return { eventName: event_name, sessionId: session_id, unlisten };
}

export async function sendExecInput({
  sessionId,
  input,
  appendNewline,
}: {
  sessionId: string;
  input: string;
  appendNewline?: boolean;
}): Promise<void> {
  await invoke<void>('send_exec_input', { sessionId, input, appendNewline });
}

export async function stopExecPodSession({ sessionId }: { sessionId: string }): Promise<void> {
  await invoke<void>('stop_exec_pod', { sessionId });
}
