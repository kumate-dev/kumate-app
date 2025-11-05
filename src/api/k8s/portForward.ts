import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export interface PortForwardEvent {
  type: string;
  line: string;
}

export interface PortForwardStartResult {
  eventName: string;
  sessionId: string;
}

export async function startPortForward(options: {
  context: string;
  namespace: string;
  resourceKind: 'pod' | 'service';
  resourceName: string;
  localPort: number;
  remotePort: number;
}): Promise<PortForwardStartResult> {
  const { context, namespace, resourceKind, resourceName, localPort, remotePort } = options;
  return invoke<PortForwardStartResult>('start_port_forward', {
    context,
    namespace,
    resourceKind,
    resourceName,
    localPort,
    remotePort,
  });
}

export function listenPortForward(eventName: string, handler: (e: PortForwardEvent) => void) {
  return listen<PortForwardEvent>(eventName, (evt) => handler(evt.payload));
}

export async function stopPortForward(sessionId: string): Promise<void> {
  await invoke('stop_port_forward', { sessionId });
}
