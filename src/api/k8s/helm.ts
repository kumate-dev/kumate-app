import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { EventHandler, EventType } from '@/types/k8sEvent';

export interface HelmRelease {
  metadata?: { name?: string; namespace?: string };
  name?: string;
  namespace?: string;
  revision?: string;
  updated?: string;
  status?: string;
  chart?: string;
  app_version?: string;
}

export interface HelmChart {
  name?: string;
  chart_version?: string;
  app_version?: string;
  description?: string;
  urls?: string[];
}

export interface HelmHistoryEntry {
  revision?: number;
  updated?: string;
  status?: string;
  chart?: string;
  app_version?: string;
  description?: string;
}

export async function listHelmReleases({
  name,
  namespaces,
}: {
  name: string;
  namespaces?: string[];
}): Promise<HelmRelease[]> {
  return await invoke<HelmRelease[]>('helm_list_releases', { name, namespaces });
}

export async function uninstallHelmReleases({
  name,
  namespace,
  releaseNames,
}: {
  name: string;
  namespace?: string;
  releaseNames: string[];
}): Promise<Array<{ status: 'Success' | 'Failure'; message?: string }>> {
  return await invoke('helm_uninstall_releases', {
    name,
    namespace,
    releaseNames,
  });
}

export async function listHelmCharts({ name }: { name: string }): Promise<HelmChart[]> {
  return await invoke<HelmChart[]>('helm_list_charts', { name });
}

export async function getHelmValues({
  name,
  namespace,
  releaseName,
}: {
  name: string;
  namespace?: string;
  releaseName: string;
}): Promise<string> {
  return await invoke<string>('helm_get_values', { name, namespace, releaseName });
}

export async function getHelmHistory({
  name,
  namespace,
  releaseName,
}: {
  name: string;
  namespace?: string;
  releaseName: string;
}): Promise<HelmHistoryEntry[]> {
  return await invoke<HelmHistoryEntry[]>('helm_get_history', { name, namespace, releaseName });
}

export async function upgradeHelmRelease({
  name,
  namespace,
  releaseName,
  chart,
  values,
  reuseValues,
  version,
}: {
  name: string;
  namespace?: string;
  releaseName: string;
  chart?: string;
  values?: any;
  reuseValues?: boolean;
  version?: string;
}): Promise<string> {
  return await invoke<string>('helm_upgrade_release', {
    name,
    namespace,
    releaseName,
    chart,
    values,
    reuseValues: !!reuseValues,
    version,
  });
}

export async function rollbackHelmRelease({
  name,
  namespace,
  releaseName,
  revision,
}: {
  name: string;
  namespace?: string;
  releaseName: string;
  revision: number;
}): Promise<string> {
  return await invoke<string>('helm_rollback_release', {
    name,
    namespace,
    releaseName,
    revision,
  });
}

export interface HelmReleaseEvent {
  type: EventType;
  object: HelmRelease;
}

export async function watchHelmReleases({
  name,
  namespaces,
  onEvent,
}: {
  name: string;
  namespaces?: string[];
  onEvent?: EventHandler<HelmReleaseEvent>;
}): Promise<{ eventName: string; unlisten: UnlistenFn }> {
  const eventName = await invoke<string>('watch_helm_releases', { name, namespaces });
  const unlisten = await listen<HelmReleaseEvent>(eventName, (evt) => {
    try {
      onEvent?.(evt.payload);
    } catch (err) {
      console.error('Error in onEvent handler:', err);
    }
  });
  return { eventName, unlisten };
}
