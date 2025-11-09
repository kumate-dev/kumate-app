import { invoke } from '@tauri-apps/api/core';

export interface CoreV1Event {
  type?: string; // Normal | Warning
  reason?: string;
  message?: string;
  count?: number;
  firstTimestamp?: string;
  lastTimestamp?: string;
  source?: { component?: string; host?: string };
  metadata?: { name?: string; namespace?: string; creationTimestamp?: string };
  involvedObject?: { kind?: string; name?: string; namespace?: string };
}

/**
 * Generic Events listing API using field selectors.
 * If `namespace` is provided, restricts the query to that namespace; otherwise, searches across selected namespaces.
 * Provide `involvedObject` with `name` and `kind` to filter events for a specific resource.
 */
export async function listEvents({
  context,
  namespace,
  involvedObject,
}: {
  context: string;
  namespace?: string;
  involvedObject?: { name?: string; kind?: string };
}): Promise<CoreV1Event[]> {
  const selectors: string[] = [];
  if (involvedObject?.name) selectors.push(`involvedObject.name=${involvedObject.name}`);
  if (involvedObject?.kind) selectors.push(`involvedObject.kind=${involvedObject.kind}`);
  const fieldSelector = selectors.length ? selectors.join(',') : undefined;

  const namespaces = namespace ? [namespace] : undefined;

  return await invoke<CoreV1Event[]>('list_events', { context, namespaces, fieldSelector });
}
