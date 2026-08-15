import { invoke } from '@tauri-apps/api/core';

export async function unwatch({ name }: { name: string }): Promise<void> {
  try {
    await invoke('unwatch', { name });
  } catch (err) {
    console.warn('unwatch failed:', err);
  }
}

/**
 * Stop every watch belonging to a cluster.
 *
 * Pass the raw context name — the backend derives the channel prefix itself.
 *
 * Do NOT go back to building `k8s://${context}/` here. Event names are escaped into the
 * character set Tauri permits (`kubernetes-admin@kubernetes` becomes
 * `kubernetes-admin_40kubernetes`), so a prefix assembled on this side would match
 * nothing and every watch for the cluster would survive the switch. The escaping lives
 * in one place, in `utils/watcher.rs`.
 */
export async function unwatchCluster({ context }: { context: string }): Promise<number> {
  try {
    const removed = await invoke<number>('unwatch_cluster', { context });
    return removed ?? 0;
  } catch (err) {
    console.warn('unwatch_cluster failed:', err);
    return 0;
  }
}

export async function watchersCount(): Promise<number> {
  try {
    const count = await invoke<number>('watchers_count');
    return count ?? 0;
  } catch (err) {
    console.warn('watchers_count failed:', err);
    return 0;
  }
}
