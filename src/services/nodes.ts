import { invoke } from '@tauri-apps/api/core';
import { EventType } from '../types/k8sEvent';

export interface NodeItem {
  name: string;
  cpu?: string;
  memory?: string;
  disk?: string;
  taints?: string;
  roles?: string;
  version?: string;
  age?: string;
  condition?: string;
}

export interface NodeEvent {
  type: EventType;
  object: NodeItem;
}

export async function listNodes({ name }: { name: string }) {
  return invoke('list_nodes', { name });
}
