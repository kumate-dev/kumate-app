import { invoke } from '@tauri-apps/api/core';

/**
 * Watch and cache diagnostics.
 *
 * The backend returns a `serde_json::Value` (see `commands/common.rs::watch_diagnostics`),
 * so nothing on the Rust side enforces this shape at the boundary. The normalisation
 * below is therefore not defensive noise: a missing or non-numeric field would otherwise
 * render as `NaN` in the status bar, which reads as a bug in the cluster rather than in
 * the IPC contract.
 *
 * This supersedes `watchers_count` for UI purposes — one round trip instead of one per
 * counter — but that command is still the right call for anything that only needs the
 * watcher count.
 */
export interface WatchDiagnostics {
  /** Live watches across every context. */
  watchers: number;
  /** Backend cap. The UI warns as the count approaches it. */
  maxWatchers: number;
  /** Objects held in the Rust-side resource cache. */
  cachedObjects: number;
  /** Contexts with a warm Kubernetes client. */
  cachedClients: number;
  /** Event names of the active watches, e.g. `pods:prod`. */
  active: string[];
}

const toCount = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

const toNames = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];

export async function getWatchDiagnostics(): Promise<WatchDiagnostics> {
  const raw = (await invoke('watch_diagnostics')) as Partial<
    Record<keyof WatchDiagnostics, unknown>
  >;

  return {
    watchers: toCount(raw.watchers),
    maxWatchers: toCount(raw.maxWatchers),
    cachedObjects: toCount(raw.cachedObjects),
    cachedClients: toCount(raw.cachedClients),
    active: toNames(raw.active),
  };
}
