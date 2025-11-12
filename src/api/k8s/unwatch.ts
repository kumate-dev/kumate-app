import { invoke } from '@tauri-apps/api/core';

export async function unwatch({ name }: { name: string }): Promise<void> {
  try {
    await invoke('unwatch', { name });
  } catch (err) {
    console.warn('unwatch failed:', err);
  }
}

export async function unwatchContext({ prefix }: { prefix: string }): Promise<number> {
  try {
    const removed = await invoke<number>('unwatch_context', { prefix });
    return removed ?? 0;
  } catch (err) {
    console.warn('unwatch_context failed:', err);
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
