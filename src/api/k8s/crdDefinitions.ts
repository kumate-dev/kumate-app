import { invoke } from '@tauri-apps/api/core';

export type CrdDefinition = {
  metadata?: { name?: string; creationTimestamp?: string };
  spec?: {
    group?: string;
    names?: { kind?: string; plural?: string; singular?: string };
    scope?: 'Namespaced' | 'Cluster';
    versions?: Array<{ name?: string; served?: boolean; storage?: boolean }>;
  };
};

export async function listCustomResourceDefinitions({
  name,
}: {
  name: string;
}): Promise<CrdDefinition[]> {
  return await invoke<CrdDefinition[]>('list_custom_resource_definitions', { name });
}
